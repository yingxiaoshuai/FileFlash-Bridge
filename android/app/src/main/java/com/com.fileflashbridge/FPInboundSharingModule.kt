package com.fileflashbridge

import android.app.Activity
import android.content.ContentResolver
import android.content.Intent
import android.database.Cursor
import android.net.Uri
import android.provider.OpenableColumns
import android.webkit.MimeTypeMap
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStream
import java.time.Instant
import java.util.Locale
import java.util.UUID

class FPInboundSharingModule(
  reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext), ActivityEventListener {
  /**
   * Android 13+ 的系统媒体选择器（Photo Picker）契约。
   *
   * 这里选择 “PickMultipleVisualMedia(50)” 的原因：
   * - 由系统选择器负责授权与返回 URI（减少手动权限处理）
   * - 限制最大选择数量，避免一次性导入导致内存/IO 压力过大
   */
  private val mediaPickerContract = ActivityResultContracts.PickMultipleVisualMedia(50)

  /**
   * React Native 的 Promise 只能 resolve/reject 一次。
   * 此处缓存正在进行中的一次选择流程，避免用户重复触发 pick 导致 promise 丢失或回调串线。
   */
  private var mediaPickerPromise: Promise? = null

  init {
    // 通过 ActivityEventListener 接收：
    // - onNewIntent：App 通过系统分享进入时，把 Intent 交给 store 暂存
    // - onActivityResult：媒体选择器返回结果
    reactContext.addActivityEventListener(this)
  }

  override fun getName() = "FPInboundSharing"

  /**
   * 让 JS 侧弹出系统媒体选择器（图片/视频），把选中的内容复制到 app cache，
   * 并返回给 JS：[{ name, mimeType, byteLength, sourcePath, relativePath, createdAt }, ...]
   *
   * 注意：这里返回的是“已复制到本地 cache 的路径”，而不是原始 content:// URI，
   * 目的是让后续 JS 侧读取/上传等逻辑只依赖一个稳定的文件路径。
   */
  @ReactMethod
  fun pickMediaFiles(promise: Promise) {
    if (mediaPickerPromise != null) {
      promise.reject("E_PICKER_BUSY", "Media picker is already active.")
      return
    }

    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("E_NO_ACTIVITY", "No active activity is available for media picking.")
      return
    }

    mediaPickerPromise = promise

    try {
      // 使用 contract 生成 intent，然后仍通过 startActivityForResult 走老回调，
      // 这样可以复用当前模块的 ActivityEventListener（而不是额外引入 registerForActivityResult）。
      val intent = mediaPickerContract.createIntent(
        activity,
        PickVisualMediaRequest.Builder()
          .setMediaType(ActivityResultContracts.PickVisualMedia.ImageAndVideo)
          .build()
      )
      activity.startActivityForResult(intent, REQUEST_PICK_MEDIA)
    } catch (error: Throwable) {
      mediaPickerPromise = null
      promise.reject("E_PICKER_UNAVAILABLE", error.message, error)
    }
  }

  @ReactMethod
  fun consumePendingSharedItems(promise: Promise) {
    try {
      val files = Arguments.createArray()
      val texts = Arguments.createArray()
      val payload = Arguments.createMap()

      // drain(): 一次性取走并清空暂存的分享 Intent，避免 JS 重复消费同一批分享内容。
      FPInboundShareStore.drain().forEach { intent ->
        appendSharedIntent(intent, files, texts)
      }

      payload.putArray("files", files)
      payload.putArray("texts", texts)
      promise.resolve(payload)
    } catch (error: Throwable) {
      promise.reject("E_SHARE_READ_FAILED", error.message, error)
    }
  }

  override fun onActivityResult(
    activity: Activity,
    requestCode: Int,
    resultCode: Int,
    data: Intent?
  ) {
    if (requestCode != REQUEST_PICK_MEDIA) {
      return
    }

    val promise = mediaPickerPromise ?: return
    mediaPickerPromise = null

    if (resultCode != Activity.RESULT_OK) {
      promise.reject("E_PICKER_CANCELLED", "User cancelled media selection.")
      return
    }

    try {
      val mediaItems = mediaPickerContract.parseResult(resultCode, data)
      val result = Arguments.createArray()
      mediaItems.forEach { uri ->
        // createdAt 记录在导入时刻（而非原文件创建时间），用作 app 内“导入时间”展示/排序。
        result.pushMap(copyUriToImportMap(uri, Instant.now().toString()))
      }
      promise.resolve(result)
    } catch (error: Throwable) {
      promise.reject("E_PICKER_FAILED", error.message, error)
    }
  }

  override fun onNewIntent(intent: Intent) {
    // App 被系统分享/打开（ACTION_SEND / ACTION_SEND_MULTIPLE 等）时，
    // 先把 intent 入队，等待 JS 在合适时机主动拉取并处理。
    FPInboundShareStore.enqueue(intent)
  }

  private fun appendSharedIntent(
    intent: Intent,
    files: WritableArray,
    texts: WritableArray
  ) {
    val createdAt = Instant.now().toString()
    extractShareUris(intent).forEach { uri ->
      files.pushMap(copyUriToImportMap(uri, createdAt))
    }

    extractSharedText(intent)?.let { content ->
      val textItem = Arguments.createMap()
      textItem.putString("content", content)
      textItem.putString("createdAt", createdAt)
      texts.pushMap(textItem)
    }
  }

  /**
   * 从分享 Intent 中提取所有可能的 Uri：
   * - 优先读取 ClipData（某些 app 会把多文件塞进 ClipData）
   * - 再根据 ACTION_SEND / ACTION_SEND_MULTIPLE 读取 EXTRA_STREAM
   */
  private fun extractShareUris(intent: Intent): List<Uri> {
    val uris = linkedSetOf<Uri>()
    val clipData = intent.clipData
    if (clipData != null) {
      for (index in 0 until clipData.itemCount) {
        clipData.getItemAt(index).uri?.let(uris::add)
      }
    }

    when (intent.action) {
      Intent.ACTION_SEND -> readSingleUriExtra(intent)?.let(uris::add)
      Intent.ACTION_SEND_MULTIPLE -> readMultipleUriExtra(intent).forEach(uris::add)
    }

    return uris.toList()
  }

  /**
   * 从分享 Intent 里尽量提取文本（纯文本/富文本/主题等），并做 trim + 空字符串过滤。
   * 这里的策略是“尽可能拿到用户看到的文本内容”，而不是只依赖单一字段。
   */
  private fun extractSharedText(intent: Intent): String? {
    val extraText = intent.getStringExtra(Intent.EXTRA_TEXT)
      ?: intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString()
      ?: intent.getStringExtra(Intent.EXTRA_HTML_TEXT)
      ?: intent.getStringExtra(Intent.EXTRA_SUBJECT)

    return extraText?.trim()?.takeIf { it.isNotEmpty() }
  }

  @Suppress("DEPRECATION")
  private fun readSingleUriExtra(intent: Intent): Uri? {
    return if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
      intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
    } else {
      intent.getParcelableExtra(Intent.EXTRA_STREAM)
    }
  }

  @Suppress("DEPRECATION")
  private fun readMultipleUriExtra(intent: Intent): List<Uri> {
    val items = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
      intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java)
    } else {
      intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM)
    }

    return items?.filterNotNull().orEmpty()
  }

  /**
   * 把一个共享/选择得到的 Uri 复制到 app cache，并构造成 JS 侧统一消费的“导入文件”描述。
   *
   * 关键点：
   * - 不把 content:// 直接暴露给 JS：JS 侧更适合用路径处理；同时避免后续失去临时授权导致读取失败
   * - 复制到 cacheDir/ffb-inbound：清晰区分“外部输入的临时文件”，便于后续清理
   */
  private fun copyUriToImportMap(uri: Uri, createdAt: String): WritableMap {
    val resolver = reactApplicationContext.contentResolver
    val inputStream = openInputStream(uri)
      ?: throw IllegalStateException("Unable to read shared content: $uri")

    val metadata = readUriMetadata(resolver, uri)
    val mimeType = resolver.getType(uri) ?: guessMimeType(metadata.name)
    val destinationFile = createImportFile(metadata.name)

    var bytesCopied = 0L
    inputStream.use { input ->
      FileOutputStream(destinationFile).use { output ->
        val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
        while (true) {
          val read = input.read(buffer)
          if (read <= 0) {
            break
          }
          output.write(buffer, 0, read)
          bytesCopied += read.toLong()
        }
      }
    }

    return Arguments.createMap().apply {
      putDouble("byteLength", bytesCopied.toDouble())
      putString("createdAt", createdAt)
      putString("mimeType", mimeType)
      putString("name", metadata.name)
      // relativePath：上层可能把它当作“原始文件名/相对路径”使用，这里先使用 name 做兜底。
      putString("relativePath", metadata.name)
      putString("sourcePath", destinationFile.absolutePath)
    }
  }

  private fun createImportFile(originalName: String): File {
    val root = File(reactApplicationContext.cacheDir, "ffb-inbound")
    if (!root.exists()) {
      root.mkdirs()
    }

    // 文件名做最小化清洗，避免路径穿越、奇怪字符导致的文件系统兼容问题。
    val safeName = originalName.replace(Regex("[^A-Za-z0-9._-]"), "_")
    return File(root, "${System.currentTimeMillis()}-${UUID.randomUUID()}-$safeName")
  }

  /**
   * 读取 Uri 的显示名称。
   * 对 content:// 优先走 ContentResolver + OpenableColumns.DISPLAY_NAME；
   * 若无法查询则退回用 lastPathSegment 兜底。
   */
  private fun readUriMetadata(resolver: ContentResolver, uri: Uri): UriMetadata {
    var name = fileNameFromUri(uri)

    resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)
      ?.use { cursor ->
        if (cursor.moveToFirst()) {
          name = readColumn(cursor, OpenableColumns.DISPLAY_NAME) ?: name
        }
      }

    return UriMetadata(
      name = name,
    )
  }

  private fun readColumn(cursor: Cursor, columnName: String): String? {
    val index = cursor.getColumnIndex(columnName)
    if (index < 0 || cursor.isNull(index)) {
      return null
    }

    return cursor.getString(index)
  }

  private fun fileNameFromUri(uri: Uri): String {
    val path = uri.lastPathSegment ?: return "shared-item"
    return path.substringAfterLast('/').ifEmpty { "shared-item" }
  }

  private fun guessMimeType(fileName: String): String? {
    val extension = fileName.substringAfterLast('.', "").lowercase(Locale.US)
    if (extension.isEmpty()) {
      return null
    }

    return MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension)
  }

  /**
   * 支持 file:// 与 content://。
   * - file://：直接走文件流（极少数来源会给 file scheme）
   * - 其它：交给 ContentResolver（覆盖 content://、android.resource:// 等）
   */
  private fun openInputStream(uri: Uri): InputStream? {
    return when (uri.scheme?.lowercase(Locale.US)) {
      "file" -> {
        val path = uri.path ?: return null
        FileInputStream(File(path))
      }

      else -> reactApplicationContext.contentResolver.openInputStream(uri)
    }
  }

  private data class UriMetadata(
    val name: String,
  )

  companion object {
    private const val REQUEST_PICK_MEDIA = 41027
  }
}
