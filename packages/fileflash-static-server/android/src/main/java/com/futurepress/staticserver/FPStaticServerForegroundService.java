package com.futurepress.staticserver;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

public class FPStaticServerForegroundService extends Service {

  private static final String CHANNEL_ID = "fileflash_bridge_transfer";
  private static final int NOTIFICATION_ID = 2415;

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    createNotificationChannel();
    startForeground(NOTIFICATION_ID, buildNotification());
    return START_STICKY;
  }

  @Nullable
  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }

  private Notification buildNotification() {
    return new NotificationCompat.Builder(this, CHANNEL_ID)
        .setContentTitle("文件闪传桥")
        .setContentText("本地传输服务正在后台保持可用")
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .setSmallIcon(resolveSmallIcon())
        .build();
  }

  private int resolveSmallIcon() {
    int applicationIcon = getApplicationInfo().icon;
    return applicationIcon != 0 ? applicationIcon : android.R.drawable.stat_sys_upload_done;
  }

  private void createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return;
    }

    NotificationManager manager =
        (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    if (manager == null) {
      return;
    }

    NotificationChannel channel =
        new NotificationChannel(
            CHANNEL_ID,
            "文件闪传桥传输服务",
            NotificationManager.IMPORTANCE_LOW);
    channel.setDescription("保持本地传输服务在后台可用");
    manager.createNotificationChannel(channel);
  }
}
