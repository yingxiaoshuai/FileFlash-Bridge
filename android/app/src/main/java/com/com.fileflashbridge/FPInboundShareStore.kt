package com.fileflashbridge

import android.content.Intent

object FPInboundShareStore {
  private const val EXTRA_ENQUEUED =
    "com.fileflashbridge.internal.EXTRA_SHARE_INTENT_ALREADY_QUEUED"

  private val pendingIntents = ArrayDeque<Intent>()

  @Synchronized
  fun enqueue(intent: Intent?) {
    if (intent == null) {
      return
    }

    val action = intent.action ?: return
    if (action != Intent.ACTION_SEND && action != Intent.ACTION_SEND_MULTIPLE) {
      return
    }

    if (intent.getBooleanExtra(EXTRA_ENQUEUED, false)) {
      return
    }

    intent.putExtra(EXTRA_ENQUEUED, true)
    pendingIntents.addLast(Intent(intent).apply {
      removeExtra(EXTRA_ENQUEUED)
    })
  }

  @Synchronized
  fun drain(): List<Intent> {
    val drained = pendingIntents.toList()
    pendingIntents.clear()
    return drained
  }
}
