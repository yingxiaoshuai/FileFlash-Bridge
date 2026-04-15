module.exports = {
  dependency: {
    platforms: {
      android: {
        packageImportPath:
          'import com.futurepress.staticserver.FPStaticServerPackage;',
        packageInstance: 'new FPStaticServerPackage()',
      },
    },
  },
};
