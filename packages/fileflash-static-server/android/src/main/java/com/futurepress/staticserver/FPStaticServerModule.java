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
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.ReadableMapKeySetIterator;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.SocketException;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import fi.iki.elonen.NanoHTTPD;

public class FPStaticServerModule extends ReactContextBaseJavaModule
    implements LifecycleEventListener {

  private static final String EVENT_REQUEST = "fpStaticServerRequest";
  private static final String LOGTAG = "FPStaticServerModule";
  private static final long REQUEST_TIMEOUT_SECONDS = 60L;

  private final ReactApplicationContext reactContext;
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
      promise.resolve(url);
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
      final String displayHost = localhostOnly ? "127.0.0.1" : getLocalIpAddress();
      server = new BridgeWebServer(bindHostname, port, session -> handleHttpRequest(session));
      server.start();
      port = server.getListeningPort();
      url = "http://" + displayHost + ":" + port;

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

    stopForegroundService();
  }

  @ReactMethod
  public void origin(Promise promise) {
    promise.resolve(server != null ? url : "");
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
    pending.latch.countDown();
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

      byte[] bodyBytes = readRequestBodyBytes(session);
      if (bodyBytes != null && bodyBytes.length > 0) {
        payload.putString("bodyBase64", Base64.encodeToString(bodyBytes, Base64.NO_WRAP));
        String contentType = session.getHeaders().get("content-type");
        if (contentType != null && contentType.contains("application/json")) {
          payload.putString("bodyText", new String(bodyBytes, StandardCharsets.UTF_8));
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

    for (Map.Entry<String, String> header : pending.headers.entrySet()) {
      response.addHeader(header.getKey(), header.getValue());
    }

    return response;
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

  private byte[] readRequestBodyBytes(NanoHTTPD.IHTTPSession session) throws Exception {
    if (session.getMethod() == NanoHTTPD.Method.GET
        || session.getMethod() == NanoHTTPD.Method.HEAD
        || session.getMethod() == NanoHTTPD.Method.DELETE) {
      return null;
    }

    Map<String, String> files = new HashMap<>();
    session.parseBody(files);
    String bodyPath = files.get("postData");
    if (bodyPath == null || bodyPath.isEmpty()) {
      return null;
    }

    File bodyFile = new File(bodyPath);
    if (!bodyFile.exists()) {
      return bodyPath.getBytes(StandardCharsets.UTF_8);
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

  private void startForegroundService() {
    Intent serviceIntent = new Intent(reactContext, FPStaticServerForegroundService.class);
    ContextCompat.startForegroundService(reactContext, serviceIntent);
  }

  private void stopForegroundService() {
    Intent serviceIntent = new Intent(reactContext, FPStaticServerForegroundService.class);
    reactContext.stopService(serviceIntent);
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

  private static class PendingResponse {
    private byte[] body = new byte[0];
    private Map<String, String> headers = new HashMap<>();
    private final CountDownLatch latch = new CountDownLatch(1);
    private int statusCode = 500;
  }
}
