export const RELEASE_MANIFEST={
  channel:'BETA',
  webVersion:'0.4.0',
  companionVersion:'0.7.41',
  companionReleaseTag:'companion-beta',
  windowsDownloadPath:'/download/windows',
  supportPath:'/support',
  updater:{
    automaticChecks:true,
    automaticInstallOnQuit:true,
    blockedDuring:['CHAMP_SELECT','RECORDING','UPLOADING'] as const,
  },
} as const;

export type ReleaseManifest=typeof RELEASE_MANIFEST;
