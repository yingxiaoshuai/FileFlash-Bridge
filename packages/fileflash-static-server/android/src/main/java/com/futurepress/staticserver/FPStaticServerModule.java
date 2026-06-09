package com.futurepress.staticserver;

import android.content.Intent;
import android.util.Base64;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.ReadableMapKeySetIterator;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.RandomAccessFile;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.SocketException;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import fi.iki.elonen.NanoHTTPD;

public class FPStaticServerModule extends ReactContextBaseJavaModule
    implements LifecycleEventListener {

  private static final String EVENT_REQUEST = "fpStaticServerRequest";
  private static final String LOGTAG = "FPStaticServerModule";
  private static final long REQUEST_TIMEOUT_SECONDS = 60L;

  private final ReactApplicationContext reactContext;
  private final ExecutorService fileIoExecutor = Executors.newFixedThreadPool(4);
  private final Map<String, NativeUploadSession> nativeUploadSessions = new ConcurrentHashMap<>();
  private final Map<String, PendingResponse> pendingResponses = new ConcurrentHashMap<>();

  private BridgeWebServer server = null;
  private boolean keepAlive = false;
  private boolean localhostOnly = false;
  private int port = 9999;
  private String url = "";

  public FPStaticServerModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;
    reactContext.addLifecycleEventListener(this);
  }

  @NonNull
  @Override
  public String getName() {
    return "FPStaticServer";
  }

  @ReactMethod
  public void start(String requestedPort, String root, Boolean localhost, Boolean keepAlive, Promise promise) {
    if (server != null) {
      promise.resolve(buildCurrentOrigin());
      return;
    }

    if (requestedPort != null) {
      try {
        port = Integer.parseInt(requestedPort);
        if (port == 0) {
          port = findRandomOpenPort();
        }
      } catch (Exception exception) {
        port = 9999;
      }
    }

    localhostOnly = localhost != null && localhost;
    this.keepAlive = keepAlive != null && keepAlive;

    try {
      /*
       * Bind: use null (all interfaces) when not localhost-only so adb reverse/forward
       * can reach 127.0.0.1:port on the guest. Binding only getLocalIpAddress() (e.g.
       * 10.0.2.15 on emulator) leaves nothing listening on loopback -> ERR_EMPTY_RESPONSE
       * on the host after `adb forward tcp:PORT tcp:PORT`.
       */
      final String bindHostname = localhostOnly ? "127.0.0.1" : null;
      server = new BridgeWebServer(bindHostname, port, session -> handleHttpRequest(session));
      server.start();
      port = server.getListeningPort();
      url = buildCurrentOrigin();

      if (this.keepAlive) {
        startForegroundService();
      }

      promise.resolve(url);
    } catch (IOException error) {
      Log.e(LOGTAG, "Unable to start native HTTP bridge", error);
      server = null;
      promise.reject("server_error", error.getMessage(), error);
    }
  }

  @ReactMethod
  public void stop() {
    if (server != null) {
      server.stop();
      server = null;
    }

    nativeUploadSessions.clear();
    stopForegroundService();
  }

  @ReactMethod
  public void origin(Promise promise) {
    promise.resolve(server != null ? buildCurrentOrigin() : "");
  }

  @ReactMethod
  public void isRunning(Promise promise) {
    promise.resolve(server != null && server.wasStarted());
  }

  @ReactMethod
  public void respond(
      String requestId,
      double status,
      ReadableMap headers,
      String bodyEncoding,
      String body) {
    PendingResponse pending = pendingResponses.get(requestId);
    if (pending == null) {
      return;
    }

    pending.statusCode = (int) status;
    pending.headers = readableMapToHashMap(headers);
    if ("base64".equals(bodyEncoding)) {
      pending.body = body != null ? Base64.decode(body, Base64.DEFAULT) : new byte[0];
    } else if ("text".equals(bodyEncoding)) {
      pending.body = body != null ? body.getBytes(StandardCharsets.UTF_8) : new byte[0];
    } else {
      pending.body = new byte[0];
    }
    pending.bodyFile = null;
    pending.latch.countDown();
  }

  @ReactMethod
  public void respondBytes(
      String requestId,
      double status,
      ReadableMap headers,
      ReadableArray body) {
    PendingResponse pending = pendingResponses.get(requestId);
    if (pending == null) {
      return;
    }

    pending.statusCode = (int) status;
    pending.headers = readableMapToHashMap(headers);
    pending.body = readableArrayToByteArray(body);
    pending.bodyFile = null;
    pending.latch.countDown();
  }

  @ReactMethod
  public void respondFile(
      String requestId,
      double status,
      ReadableMap headers,
      String path,
      double offset,
      double length) {
    PendingResponse pending = pendingResponses.get(requestId);
    if (pending == null) {
      return;
    }

    pending.statusCode = (int) status;
    pending.headers = readableMapToHashMap(headers);
    pending.body = null;
    pending.bodyFile =
        new ResponseBodyFile(
            path,
            Math.max(0L, (long) offset),
            Math.max(0L, (long) length));
    pending.latch.countDown();
  }

  @ReactMethod
  public void writeFileFromPathAtOffset(
      String destinationPath,
      String sourcePath,
      double offset,
      double length,
      Promise promise) {
    fileIoExecutor.execute(
        () -> writeFileFromPathAtOffsetOnFileThread(
          destinationPath,
          sourcePath,
          offset,
          length,
          promise));
  }

  @ReactMethod
  public void registerUploadSession(
      String uploadId,
      String tempPath,
      double totalBytes,
      Promise promise) {
    try {
      if (uploadId == null || uploadId.trim().isEmpty()) {
        throw new IOException("Upload id is required.");
      }

      if (tempPath == null || tempPath.trim().isEmpty()) {
        throw new IOException("Upload temp path is required.");
      }

      long normalizedTotalBytes = Math.max(0L, (long) totalBytes);
      if (normalizedTotalBytes <= 0L) {
        throw new IOException("Upload size is invalid.");
      }

      File destination = new File(tempPath);
      File destinationDir = destination.getParentFile();
      if (destinationDir != null && !destinationDir.exists() && !destinationDir.mkdirs()) {
        throw new IOException("Unable to create upload directory: " + destinationDir);
      }

      nativeUploadSessions.put(
          uploadId,
          new NativeUploadSession(destination.getAbsolutePath(), normalizedTotalBytes));
      promise.resolve(null);
    } catch (Exception error) {
      promise.reject(
          "EUNSPECIFIED",
          error.getMessage() != null ? error.getMessage() : "Unable to register upload session.",
          error);
    }
  }

  @ReactMethod
  public void unregisterUploadSession(String uploadId, Promise promise) {
    if (uploadId != null) {
      nativeUploadSessions.remove(uploadId);
    }
    promise.resolve(null);
  }

  private void writeFileFromPathAtOffsetOnFileThread(
      String destinationPath,
      String sourcePath,
      double offset,
      double length,
      Promise promise) {
    try {
      if (destinationPath == null || destinationPath.isEmpty()) {
        throw new IOException("Destination path is required.");
      }
      if (sourcePath == null || sourcePath.isEmpty()) {
        throw new IOException("Source path is required.");
      }

      File destination = new File(destinationPath);
      File destinationDir = destination.getParentFile();
      if (destinationDir != null && !destinationDir.exists() && !destinationDir.mkdirs()) {
        throw new IOException("Unable to create destination directory: " + destinationDir);
      }

      long remaining = Math.max(0L, (long) length);
      long writeOffset = Math.max(0L, (long) offset);
      byte[] buffer = new byte[256 * 1024];

      try (FileInputStream inputStream = new FileInputStream(sourcePath);
          RandomAccessFile outputFile = new RandomAccessFile(destination, "rw")) {
        outputFile.seek(writeOffset);
        while (remaining > 0L) {
          int bytesRead =
              inputStream.read(buffer, 0, (int) Math.min((long) buffer.length, remaining));
          if (bytesRead == -1) {
            break;
          }

          outputFile.write(buffer, 0, bytesRead);
          remaining -= bytesRead;
        }
      }

      if (remaining > 0L) {
        throw new IOException(
            "Source file ended before " + (long) length + " bytes could be written.");
      }

      promise.resolve(null);
    } catch (Exception error) {
      promise.reject(
          "EUNSPECIFIED",
          error.getMessage() != null ? error.getMessage() : "Unable to write file chunk.",
          error);
    }
  }

  @ReactMethod
  public void addListener(String eventName) {
    // Required for NativeEventEmitter compatibility.
  }

  @ReactMethod
  public void removeListeners(double count) {
    // Required for NativeEventEmitter compatibility.
  }

  @Override
  public void onHostResume() {}

  @Override
  public void onHostPause() {}

  @Override
  public void onHostDestroy() {
    stop();
  }

  private NanoHTTPD.Response handleHttpRequest(NanoHTTPD.IHTTPSession session) {
    String requestId = UUID.randomUUID().toString();
    PendingResponse pending = new PendingResponse();
    pendingResponses.put(requestId, pending);
    String bodyFilePathToCleanup = null;

    try {
      WritableMap payload = Arguments.createMap();
      payload.putString("requestId", requestId);
      payload.putString("method", session.getMethod().name());
      payload.putString("path", session.getUri());
      payload.putMap("headers", Arguments.makeNativeMap(new HashMap<>(session.getHeaders())));
      payload.putMap("query", Arguments.makeNativeMap(new HashMap<>(session.getParms())));
      if (session.getRemoteIpAddress() != null) {
        payload.putString("remoteAddress", session.getRemoteIpAddress());
      }

      NativeUploadPartPayload nativeUploadPart = readNativeUploadPartPayload(session);
      if (nativeUploadPart != null) {
        WritableMap nativeUploadPartMap = Arguments.createMap();
        nativeUploadPartMap.putDouble("byteLength", (double) nativeUploadPart.byteLength);
        nativeUploadPartMap.putDouble("offset", (double) nativeUploadPart.offset);
        payload.putMap("nativeUploadPart", nativeUploadPartMap);
      } else {
        RequestBodyPayload requestBody = readRequestBodyPayload(session);
        if (requestBody != null) {
          if (requestBody.filePath != null) {
            WritableMap bodyFile = Arguments.createMap();
            bodyFile.putDouble("byteLength", (double) requestBody.byteLength);
            bodyFile.putString("path", requestBody.filePath);
            payload.putMap("bodyFile", bodyFile);
            bodyFilePathToCleanup = requestBody.filePath;
          } else if (requestBody.bytes != null && requestBody.bytes.length > 0) {
            String contentType = session.getHeaders().get("content-type");
            if (isUtf8TextRequest(contentType)) {
              payload.putString(
                  "bodyText",
                  new String(requestBody.bytes, StandardCharsets.UTF_8));
            } else {
              payload.putArray("bodyBytes", byteArrayToWritableArray(requestBody.bytes));
            }
          }
        }
      }

      emitEvent(EVENT_REQUEST, payload);

      boolean completed = pending.latch.await(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS);
      pendingResponses.remove(requestId);
      if (!completed) {
        return jsonErrorResponse(504, "Native request bridge timed out.");
      }

      return buildNativeResponse(pending);
    } catch (Exception error) {
      pendingResponses.remove(requestId);
      return jsonErrorResponse(500, error.getMessage() != null ? error.getMessage() : "Unexpected bridge failure.");
    } finally {
      if (bodyFilePathToCleanup != null) {
        //noinspection ResultOfMethodCallIgnored
        new File(bodyFilePathToCleanup).delete();
      }
    }
  }

  private NanoHTTPD.Response buildNativeResponse(PendingResponse pending) {
    String contentType =
        pending.headers.getOrDefault("content-type", "application/octet-stream");
    NanoHTTPD.Response.IStatus status =
        NanoHTTPD.Response.Status.lookup(pending.statusCode);

    if (status == null) {
      final int statusCode = pending.statusCode;
      status =
          new NanoHTTPD.Response.IStatus() {
            @Override
            public int getRequestStatus() {
              return statusCode;
            }

            @Override
            public String getDescription() {
              return String.valueOf(statusCode);
            }
          };
    }

    if (pending.bodyFile != null) {
      return buildFileResponse(status, contentType, pending);
    }

    NanoHTTPD.Response response =
        NanoHTTPD.newFixedLengthResponse(
            status, contentType, pending.body != null ? new String(pending.body, StandardCharsets.ISO_8859_1) : "");

    if (pending.body != null && pending.body.length > 0) {
      response =
          NanoHTTPD.newFixedLengthResponse(
              status,
              contentType,
              new java.io.ByteArrayInputStream(pending.body),
              pending.body.length);
    }

    boolean allowContentLengthHeader = pending.body == null || pending.body.length == 0;
    for (Map.Entry<String, String> header : pending.headers.entrySet()) {
      if (shouldForwardAdditionalHeader(header.getKey(), allowContentLengthHeader)) {
        response.addHeader(header.getKey(), header.getValue());
      }
    }

    return response;
  }

  private NanoHTTPD.Response buildFileResponse(
      NanoHTTPD.Response.IStatus status,
      String contentType,
      PendingResponse pending) {
    ResponseBodyFile bodyFile = pending.bodyFile;
    File file = new File(bodyFile.path);
    if (!file.exists() || !file.isFile()) {
      return jsonErrorResponse(404, "Response file is missing: " + bodyFile.path);
    }

    long fileLength = file.length();
    long start = Math.min(bodyFile.offset, fileLength);
    long responseLength = Math.min(bodyFile.length, Math.max(0L, fileLength - start));
    if (responseLength != bodyFile.length) {
      return jsonErrorResponse(500, "Response file range is invalid.");
    }

    NanoHTTPD.Response response;

    if (responseLength == 0L) {
      response = NanoHTTPD.newFixedLengthResponse(status, contentType, "");
    } else {
      try {
        FileInputStream inputStream = new FileInputStream(file);
        skipFully(inputStream, start);
        response =
            NanoHTTPD.newFixedLengthResponse(
                status,
                contentType,
                new ClosingInputStream(inputStream),
                responseLength);
      } catch (IOException error) {
        return jsonErrorResponse(
            500,
            error.getMessage() != null ? error.getMessage() : "Unable to read response file.");
      }
    }

    for (Map.Entry<String, String> header : pending.headers.entrySet()) {
      if (shouldForwardAdditionalHeader(header.getKey(), false)) {
        response.addHeader(header.getKey(), header.getValue());
      }
    }

    return response;
  }

  private boolean shouldForwardAdditionalHeader(String key, boolean allowContentLength) {
    if (key == null || key.trim().isEmpty()) {
      return false;
    }

    String normalized = key.toLowerCase(Locale.ROOT);
    if ("content-length".equals(normalized)) {
      return allowContentLength;
    }

    return !("cache-control".equals(normalized)
        || "connection".equals(normalized)
        || "content-type".equals(normalized)
        || "date".equals(normalized)
        || "etag".equals(normalized)
        || "last-modified".equals(normalized)
        || "server".equals(normalized)
        || "transfer-encoding".equals(normalized));
  }

  private NanoHTTPD.Response jsonErrorResponse(int statusCode, String message) {
    String payload =
        "{\"code\":\"INVALID_REQUEST\",\"message\":\""
            + message.replace("\"", "\\\"")
            + "\"}";
    NanoHTTPD.Response response =
        NanoHTTPD.newFixedLengthResponse(
            resolveStatus(statusCode),
            "application/json; charset=utf-8",
            payload);
    response.addHeader("content-type", "application/json; charset=utf-8");
    return response;
  }

  private void emitEvent(String eventName, WritableMap payload) {
    reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
        .emit(eventName, payload);
  }

  private NativeUploadPartPayload readNativeUploadPartPayload(NanoHTTPD.IHTTPSession session)
      throws Exception {
    if (session.getMethod() != NanoHTTPD.Method.POST
        || !"/api/upload/part".equals(session.getUri())) {
      return null;
    }

    String uploadId = session.getParms().get("uploadId");
    if (uploadId == null || uploadId.trim().isEmpty()) {
      return null;
    }

    NativeUploadSession uploadSession = nativeUploadSessions.get(uploadId);
    if (uploadSession == null) {
      return null;
    }

    Long offset = parseNonNegativeLong(session.getParms().get("offset"));
    Long contentLength = parseContentLength(session.getHeaders().get("content-length"));
    if (offset == null || contentLength == null) {
      return null;
    }

    if (contentLength <= 0L) {
      return new NativeUploadPartPayload(0L, offset);
    }

    if (offset > uploadSession.totalBytes || contentLength > uploadSession.totalBytes - offset) {
      throw new IOException("Upload chunk exceeds the declared file size.");
    }

    writeFixedLengthBodyToUploadSession(
        session.getInputStream(),
        uploadSession,
        offset,
        contentLength);
    return new NativeUploadPartPayload(contentLength, offset);
  }

  private Long parseNonNegativeLong(String value) {
    if (value == null || value.trim().isEmpty()) {
      return null;
    }

    try {
      long parsed = Long.parseLong(value.trim());
      return parsed >= 0L ? parsed : null;
    } catch (NumberFormatException ignored) {
      return null;
    }
  }

  private void writeFixedLengthBodyToUploadSession(
      InputStream inputStream,
      NativeUploadSession uploadSession,
      long offset,
      long contentLength)
      throws IOException {
    File destination = new File(uploadSession.tempPath);
    File destinationDir = destination.getParentFile();
    if (destinationDir != null && !destinationDir.exists() && !destinationDir.mkdirs()) {
      throw new IOException("Unable to create upload directory: " + destinationDir);
    }

    byte[] buffer = new byte[256 * 1024];
    long remaining = contentLength;

    try (RandomAccessFile outputFile = new RandomAccessFile(destination, "rw")) {
      outputFile.seek(offset);
      while (remaining > 0L) {
        int bytesRead =
            inputStream.read(buffer, 0, (int) Math.min((long) buffer.length, remaining));
        if (bytesRead == -1) {
          break;
        }

        outputFile.write(buffer, 0, bytesRead);
        remaining -= bytesRead;
      }
    }

    if (remaining > 0L) {
      throw new IOException(
          "Request body ended early. Expected " + contentLength + " bytes but received "
              + (contentLength - remaining) + ".");
    }
  }

  private RequestBodyPayload readRequestBodyPayload(NanoHTTPD.IHTTPSession session) throws Exception {
    if (session.getMethod() == NanoHTTPD.Method.GET
        || session.getMethod() == NanoHTTPD.Method.HEAD
        || session.getMethod() == NanoHTTPD.Method.DELETE) {
      return null;
    }

    Long contentLength = parseContentLength(session.getHeaders().get("content-length"));
    if (shouldStoreRequestBodyInFile(session)) {
      if (contentLength != null) {
        if (contentLength <= 0L) {
          return null;
        }

        File bodyFile =
            File.createTempFile(
                "fileflash-http-body-",
                ".part",
                reactContext.getCacheDir());
        readFixedLengthBodyToFile(session.getInputStream(), contentLength, bodyFile);
        return RequestBodyPayload.fromFile(bodyFile.getAbsolutePath(), contentLength);
      }

      Map<String, String> files = new HashMap<>();
      session.parseBody(files);

      String rawContentPath = files.get("content");
      if (rawContentPath != null && !rawContentPath.isEmpty()) {
        File rawContentFile = new File(rawContentPath);
        return RequestBodyPayload.fromFile(rawContentPath, rawContentFile.length());
      }

      String postData = files.get("postData");
      return postData == null || postData.isEmpty()
          ? null
          : RequestBodyPayload.fromBytes(postData.getBytes(StandardCharsets.UTF_8));
    }

    if (contentLength != null) {
      if (contentLength <= 0L) {
        return null;
      }
      return RequestBodyPayload.fromBytes(readFixedLengthBody(session.getInputStream(), contentLength));
    }

    Map<String, String> files = new HashMap<>();
    session.parseBody(files);

    String rawContentPath = files.get("content");
    if (rawContentPath != null && !rawContentPath.isEmpty()) {
      return RequestBodyPayload.fromBytes(readBodyFileBytes(rawContentPath));
    }

    String postData = files.get("postData");
    return postData == null || postData.isEmpty()
        ? null
        : RequestBodyPayload.fromBytes(postData.getBytes(StandardCharsets.UTF_8));
  }

  private Long parseContentLength(String value) {
    if (value == null || value.trim().isEmpty()) {
      return null;
    }

    try {
      long parsed = Long.parseLong(value.trim());
      return parsed >= 0L ? parsed : null;
    } catch (NumberFormatException ignored) {
      return null;
    }
  }

  private byte[] readFixedLengthBody(InputStream inputStream, long contentLength)
      throws IOException {
    ByteArrayOutputStream outputStream =
        new ByteArrayOutputStream((int) Math.min(contentLength, 8192L));
    byte[] buffer = new byte[8192];
    long remaining = contentLength;

    while (remaining > 0L) {
      int bytesRead =
          inputStream.read(buffer, 0, (int) Math.min((long) buffer.length, remaining));
      if (bytesRead == -1) {
        break;
      }

      outputStream.write(buffer, 0, bytesRead);
      remaining -= bytesRead;
    }

    if (remaining > 0L) {
      throw new IOException(
          "Request body ended early. Expected " + contentLength + " bytes but received "
              + (contentLength - remaining) + ".");
    }

    return outputStream.toByteArray();
  }

  private void readFixedLengthBodyToFile(
      InputStream inputStream,
      long contentLength,
      File destination)
      throws IOException {
    byte[] buffer = new byte[8192];
    long remaining = contentLength;

    try (FileOutputStream outputStream = new FileOutputStream(destination)) {
      while (remaining > 0L) {
        int bytesRead =
            inputStream.read(buffer, 0, (int) Math.min((long) buffer.length, remaining));
        if (bytesRead == -1) {
          break;
        }

        outputStream.write(buffer, 0, bytesRead);
        remaining -= bytesRead;
      }
    } catch (IOException error) {
      //noinspection ResultOfMethodCallIgnored
      destination.delete();
      throw error;
    }

    if (remaining > 0L) {
      //noinspection ResultOfMethodCallIgnored
      destination.delete();
      throw new IOException(
          "Request body ended early. Expected " + contentLength + " bytes but received "
              + (contentLength - remaining) + ".");
    }
  }

  private byte[] readBodyFileBytes(String path) throws IOException {
    File bodyFile = new File(path);
    if (!bodyFile.exists()) {
      throw new IOException("Request body temp file is missing: " + path);
    }

    try (FileInputStream inputStream = new FileInputStream(bodyFile);
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
      byte[] buffer = new byte[8192];
      int bytesRead;
      while ((bytesRead = inputStream.read(buffer)) != -1) {
        outputStream.write(buffer, 0, bytesRead);
      }
      return outputStream.toByteArray();
    } finally {
      //noinspection ResultOfMethodCallIgnored
      bodyFile.delete();
    }
  }

  private Map<String, String> readableMapToHashMap(ReadableMap map) {
    if (map == null) {
      return Collections.emptyMap();
    }

    Map<String, String> result = new HashMap<>();
    ReadableMapKeySetIterator iterator = map.keySetIterator();
    while (iterator.hasNextKey()) {
      String key = iterator.nextKey();
      if (map.isNull(key)) {
        continue;
      }
      result.put(key, map.getString(key));
    }
    return result;
  }

  private byte[] readableArrayToByteArray(ReadableArray array) {
    if (array == null) {
      return new byte[0];
    }

    byte[] bytes = new byte[array.size()];
    for (int index = 0; index < array.size(); index += 1) {
      bytes[index] = (byte) (((int) array.getDouble(index)) & 0xff);
    }
    return bytes;
  }

  private com.facebook.react.bridge.WritableArray byteArrayToWritableArray(byte[] bytes) {
    com.facebook.react.bridge.WritableArray array = Arguments.createArray();
    for (byte value : bytes) {
      array.pushInt(value & 0xff);
    }
    return array;
  }

  private void skipFully(InputStream inputStream, long byteCount) throws IOException {
    long remaining = byteCount;
    while (remaining > 0L) {
      long skipped = inputStream.skip(remaining);
      if (skipped > 0L) {
        remaining -= skipped;
        continue;
      }

      if (inputStream.read() == -1) {
        throw new IOException("Unable to seek response file.");
      }
      remaining -= 1L;
    }
  }

  private boolean isUtf8TextRequest(String contentType) {
    if (contentType == null) {
      return false;
    }

    String normalized = contentType.toLowerCase(Locale.ROOT);
    return normalized.contains("application/json")
        || normalized.startsWith("text/");
  }

  private boolean shouldStoreRequestBodyInFile(NanoHTTPD.IHTTPSession session) {
    NanoHTTPD.Method method = session.getMethod();
    if (method != NanoHTTPD.Method.POST
        && method != NanoHTTPD.Method.PUT
        && method != NanoHTTPD.Method.PATCH) {
      return false;
    }

    String path = session.getUri();
    if ("/api/upload/part".equals(path)) {
      return true;
    }

    String contentType = session.getHeaders().get("content-type");
    String normalized = contentType != null ? contentType.toLowerCase(Locale.ROOT) : "";
    if ("/api/upload".equals(path)) {
      return !(normalized.contains("application/json") || normalized.startsWith("text/"));
    }

    return false;
  }

  private void startForegroundService() {
    Intent serviceIntent = new Intent(reactContext, FPStaticServerForegroundService.class);
    ContextCompat.startForegroundService(reactContext, serviceIntent);
  }

  private void stopForegroundService() {
    Intent serviceIntent = new Intent(reactContext, FPStaticServerForegroundService.class);
    reactContext.stopService(serviceIntent);
  }

  private String buildCurrentOrigin() {
    int activePort = server != null ? server.getListeningPort() : port;
    String displayHost = localhostOnly ? "127.0.0.1" : getLocalIpAddress();
    url = "http://" + displayHost + ":" + activePort;
    return url;
  }

  private String getLocalIpAddress() {
    try {
      for (Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
          interfaces.hasMoreElements(); ) {
        NetworkInterface networkInterface = interfaces.nextElement();
        for (Enumeration<InetAddress> inetAddresses = networkInterface.getInetAddresses();
            inetAddresses.hasMoreElements(); ) {
          InetAddress inetAddress = inetAddresses.nextElement();
          if (!inetAddress.isLoopbackAddress() && InetAddressUtils.isIPv4Address(inetAddress.getHostAddress())) {
            return inetAddress.getHostAddress();
          }
        }
      }
    } catch (SocketException exception) {
      Log.e(LOGTAG, "Unable to resolve local IP address", exception);
    }

    return "127.0.0.1";
  }

  private int findRandomOpenPort() throws IOException {
    ServerSocket socket = new ServerSocket(0);
    int randomPort = socket.getLocalPort();
    socket.close();
    return randomPort;
  }

  private NanoHTTPD.Response.IStatus resolveStatus(final int statusCode) {
    NanoHTTPD.Response.IStatus resolved = NanoHTTPD.Response.Status.lookup(statusCode);
    if (resolved != null) {
      return resolved;
    }

    return new NanoHTTPD.Response.IStatus() {
      @Override
      public int getRequestStatus() {
        return statusCode;
      }

      @Override
      public String getDescription() {
        return String.valueOf(statusCode);
      }
    };
  }

  private static class NativeUploadSession {
    private final String tempPath;
    private final long totalBytes;

    NativeUploadSession(String tempPath, long totalBytes) {
      this.tempPath = tempPath != null ? tempPath : "";
      this.totalBytes = totalBytes;
    }
  }

  private static class NativeUploadPartPayload {
    private final long byteLength;
    private final long offset;

    NativeUploadPartPayload(long byteLength, long offset) {
      this.byteLength = byteLength;
      this.offset = offset;
    }
  }

  private static class PendingResponse {
    private byte[] body = new byte[0];
    private ResponseBodyFile bodyFile = null;
    private Map<String, String> headers = new HashMap<>();
    private final CountDownLatch latch = new CountDownLatch(1);
    private int statusCode = 500;
  }

  private static class ResponseBodyFile {
    private final long length;
    private final long offset;
    private final String path;

    ResponseBodyFile(String path, long offset, long length) {
      this.path = path != null ? path : "";
      this.offset = offset;
      this.length = length;
    }
  }

  private static class RequestBodyPayload {
    private final long byteLength;
    private final byte[] bytes;
    private final String filePath;

    private RequestBodyPayload(byte[] bytes, String filePath, long byteLength) {
      this.bytes = bytes;
      this.filePath = filePath;
      this.byteLength = byteLength;
    }

    static RequestBodyPayload fromBytes(byte[] bytes) {
      return new RequestBodyPayload(bytes, null, bytes != null ? bytes.length : 0L);
    }

    static RequestBodyPayload fromFile(String filePath, long byteLength) {
      return new RequestBodyPayload(null, filePath, byteLength);
    }
  }

  private static class ClosingInputStream extends FilterInputStream {
    ClosingInputStream(InputStream inputStream) {
      super(inputStream);
    }
  }
}
