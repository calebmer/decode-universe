import installExtension, { REACT_DEVELOPER_TOOLS } from 'electron-devtools-installer';

function install() {
  installExtension(REACT_DEVELOPER_TOOLS, false);
}

export const DevTools = {
  install,
};
