import type { RNPackage, RNPackageContext } from '@rnoh/react-native-openharmony/ts';
import { ClipboardPackage } from '@react-native-oh-tpl/clipboard/ts';
import { NetInfoPackage } from '@react-native-oh-tpl/netinfo/ts';
import { FsPackage } from '@react-native-oh-tpl/react-native-fs/ts';
import { SafeAreaViewPackage } from '@react-native-oh-tpl/react-native-safe-area-context/ts';
import { RNSharePackage } from '@react-native-oh-tpl/react-native-share/ts';
import { TcpSocketPackage } from '@react-native-oh-tpl/react-native-tcp-socket/ts';
import { FPStaticServerPackage } from './fpstaticserver/FPStaticServerPackage';
import { createRNOHPackages as createRNOHPackagesAutolinking } from './RNOHPackagesFactory';

export function getRNOHPackages(ctx: RNPackageContext): RNPackage[] {
  return [
    ...createRNOHPackagesAutolinking(ctx),
    new ClipboardPackage(ctx),
    new NetInfoPackage(ctx),
    new FsPackage(ctx),
    new SafeAreaViewPackage(ctx),
    new RNSharePackage(ctx),
    new TcpSocketPackage(ctx),
    new FPStaticServerPackage(ctx),
  ];
}
