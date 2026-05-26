package com.fileflashbridge

import android.app.Activity
import android.content.ContentValues
import android.content.ContentResolver
import android.content.Intent
import android.os.Build
import android.os.Environment
import android.net.Uri
import android.provider.DocumentsContract
import android.provider.MediaStore
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import java.io.File
import java.io.FileInputStream
import java.util.concurrent.Executors

class FPFileAccessModule(
  reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext), ActivityEventListener {
  private data class DirectorySaveFile(
    val displayName: String,
    val mimeType: String,
    val sourcePath: String
  )

  private val fileCopyExecutor = Executors.newSingleThreadExecutor()
  private var pendingDirectorySaveFiles: List<DirectorySaveFile>? = null
  private var pendingDirectorySavePromise: Promise? = null

  init {
    reactContext.addActivityEventListener(this)
  }

  override fun getName() = "FPFileAccess"

  @ReactMethod
  fun saveFilesToDownloads(files: ReadableArray, promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      saveFilesToDirectory(files, promise)
      return
    }

    val parsedFiles = try {
      parseDirectorySaveFiles(files)
    } catch (error: Throwable) {
      promise.reject("E_INVALID_FILES", error.message, error)
      return
    }

    if (parsedFiles.isEmpty()) {
      promise.reject("E_NO_FILES", "请选择要下载的文件。")
      return
    }

    fileCopyExecutor.execute {
      try {
        val destinationUris = copyFilesToDownloads(parsedFiles)
        promise.resolve(destinationUris)
      } catch (error: Throwable) {
        promise.reject("E_SAVE_FAILED", error.message, error)
      }
    }
  }

  @ReactMethod
  fun saveFilesToDirectory(files: ReadableArray, promise: Promise) {
    if (pendingDirectorySavePromise != null) {
      promise.reject("E_SAVE_BUSY", "A directory save is already active.")
      return
    }

    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("E_NO_ACTIVITY", "No active activity is available for saving files.")
      return
    }

    val parsedFiles = try {
      parseDirectorySaveFiles(files)
    } catch (error: Throwable) {
      promise.reject("E_INVALID_FILES", error.message, error)
      return
    }

    if (parsedFiles.isEmpty()) {
      promise.reject("E_NO_FILES", "请选择要下载的文件。")
      return
    }

    pendingDirectorySaveFiles = parsedFiles
    pendingDirectorySavePromise = promise

    try {
      val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
        addFlags(Intent.FLAG_GRANT_PREFIX_URI_PERMISSION)
      }
      activity.startActivityForResult(intent, REQUEST_SAVE_FILES_TO_DIRECTORY)
    } catch (error: Throwable) {
      clearPendingDirectorySave()
      promise.reject("E_DIRECTORY_PICKER_UNAVAILABLE", error.message, error)
    }
  }

  override fun onActivityResult(
    activity: Activity,
    requestCode: Int,
    resultCode: Int,
    data: Intent?
  ) {
    if (requestCode != REQUEST_SAVE_FILES_TO_DIRECTORY) {
      return
    }

    val promise = pendingDirectorySavePromise ?: return
    val files = pendingDirectorySaveFiles.orEmpty()

    if (resultCode != Activity.RESULT_OK) {
      clearPendingDirectorySave()
      promise.reject("E_SAVE_CANCELLED", "已取消导出。")
      return
    }

    val treeUri = data?.data
    if (treeUri == null) {
      clearPendingDirectorySave()
      promise.reject("E_INVALID_DIRECTORY", "未能读取目标文件夹。")
      return
    }

    persistTreePermission(treeUri, data)

    fileCopyExecutor.execute {
      try {
        val destinationUris = copyFilesToDirectory(treeUri, files)
        promise.resolve(destinationUris)
      } catch (error: Throwable) {
        promise.reject("E_SAVE_FAILED", error.message, error)
      } finally {
        clearPendingDirectorySave()
      }
    }
  }

  override fun onNewIntent(intent: Intent) = Unit

  private fun parseDirectorySaveFiles(files: ReadableArray): List<DirectorySaveFile> {
    val parsed = mutableListOf<DirectorySaveFile>()
    for (index in 0 until files.size()) {
      val item = files.getMap(index)
        ?: throw IllegalArgumentException("Invalid file entry at index $index.")
      parsed.add(parseDirectorySaveFile(item, index))
    }
    return parsed
  }

  private fun parseDirectorySaveFile(
    item: ReadableMap,
    index: Int
  ): DirectorySaveFile {
    val sourcePath = optionalString(item, "sourcePath")?.trim()
      ?: throw IllegalArgumentException("Missing sourcePath for file at index $index.")
    val displayName = sanitizeFileName(
      optionalString(item, "displayName")?.trim().orEmpty().ifBlank {
        fileNameFromPath(sourcePath)
      }
    )
    val mimeType = optionalString(item, "mimeType")?.trim()?.takeIf { it.isNotEmpty() }
      ?: "application/octet-stream"

    return DirectorySaveFile(
      displayName = displayName,
      mimeType = mimeType,
      sourcePath = normalizeFilePath(sourcePath)
    )
  }

  private fun optionalString(item: ReadableMap, key: String): String? {
    return if (item.hasKey(key) && !item.isNull(key)) item.getString(key) else null
  }

  private fun copyFilesToDirectory(
    treeUri: Uri,
    files: List<DirectorySaveFile>
  ) = Arguments.createArray().also { destinationUris ->
    val resolver = reactApplicationContext.contentResolver
    val parentDocumentUri = DocumentsContract.buildDocumentUriUsingTree(
      treeUri,
      DocumentsContract.getTreeDocumentId(treeUri)
    )

    files.forEach { file ->
      val sourceFile = File(file.sourcePath)
      if (!sourceFile.isFile) {
        throw IllegalStateException("源文件不可读取：${file.displayName}")
      }

      val destinationUri = DocumentsContract.createDocument(
        resolver,
        parentDocumentUri,
        file.mimeType,
        file.displayName
      ) ?: throw IllegalStateException("无法创建目标文件：${file.displayName}")

      copyFileToUri(resolver, sourceFile, destinationUri)
      destinationUris.pushString(destinationUri.toString())
    }
  }

  private fun copyFilesToDownloads(
    files: List<DirectorySaveFile>
  ) = Arguments.createArray().also { destinationUris ->
    val resolver = reactApplicationContext.contentResolver

    files.forEach { file ->
      val sourceFile = File(file.sourcePath)
      if (!sourceFile.isFile) {
        throw IllegalStateException("源文件不可读取：${file.displayName}")
      }

      val destinationUri = createDownloadsFile(resolver, file)
      try {
        copyFileToUri(resolver, sourceFile, destinationUri)
        markDownloadsFileReady(resolver, destinationUri)
        destinationUris.pushString(destinationUri.toString())
      } catch (error: Throwable) {
        resolver.delete(destinationUri, null, null)
        throw error
      }
    }
  }

  private fun createDownloadsFile(
    resolver: ContentResolver,
    file: DirectorySaveFile
  ): Uri {
    val values = ContentValues().apply {
      put(MediaStore.MediaColumns.DISPLAY_NAME, file.displayName)
      put(MediaStore.MediaColumns.MIME_TYPE, file.mimeType)
      put(
        MediaStore.MediaColumns.RELATIVE_PATH,
        "${Environment.DIRECTORY_DOWNLOADS}/FileFlashBridge"
      )
      put(MediaStore.MediaColumns.IS_PENDING, 1)
    }

    return resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
      ?: throw IllegalStateException("无法创建下载文件：${file.displayName}")
  }

  private fun markDownloadsFileReady(
    resolver: ContentResolver,
    destinationUri: Uri
  ) {
    val values = ContentValues().apply {
      put(MediaStore.MediaColumns.IS_PENDING, 0)
    }
    resolver.update(destinationUri, values, null, null)
  }

  private fun copyFileToUri(
    resolver: ContentResolver,
    sourceFile: File,
    destinationUri: Uri
  ) {
    FileInputStream(sourceFile).use { input ->
      val output = resolver.openOutputStream(destinationUri, "w")
        ?: throw IllegalStateException("无法打开目标文件。")
      output.use { input.copyTo(it, FILE_COPY_BUFFER_SIZE) }
    }
  }

  private fun persistTreePermission(treeUri: Uri, data: Intent) {
    val takeFlags = data.flags and (
      Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
    )
    if (takeFlags == 0) {
      return
    }

    try {
      reactApplicationContext.contentResolver.takePersistableUriPermission(
        treeUri,
        takeFlags
      )
    } catch (_: SecurityException) {
      // The current one-shot grant is enough for this save operation.
    }
  }

  private fun clearPendingDirectorySave() {
    pendingDirectorySaveFiles = null
    pendingDirectorySavePromise = null
  }

  private fun normalizeFilePath(path: String): String {
    if (!path.startsWith("file://")) {
      return path
    }

    return Uri.parse(path).path ?: path.removePrefix("file://")
  }

  private fun fileNameFromPath(path: String): String {
    val normalized = path.replace('\\', '/')
    return normalized.substringAfterLast('/', "download.bin")
  }

  private fun sanitizeFileName(fileName: String): String {
    val sanitized = fileName
      .map { char ->
        if (char.code < 32 || char in INVALID_FILE_NAME_CHARS) '_' else char
      }
      .joinToString("")
      .trim()
    return sanitized.ifEmpty { "download.bin" }
  }

  companion object {
    private const val REQUEST_SAVE_FILES_TO_DIRECTORY = 4207
    private const val FILE_COPY_BUFFER_SIZE = 1024 * 1024
    private val INVALID_FILE_NAME_CHARS = setOf('<', '>', ':', '"', '/', '\\', '|', '?', '*')
  }
}
