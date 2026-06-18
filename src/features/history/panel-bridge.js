import { mountPanel, unmountPanel } from './panel.jsx';

let panelRef = null;

export function initPanel() {
  if (!panelRef) {
    panelRef = mountPanel();
  }
  return panelRef;
}

export function resetPanel() {
  if (panelRef && panelRef.reset) {
    panelRef.reset();
  }
}

export function updatePanel(videos) {
  if (panelRef && panelRef.setVideos) {
    panelRef.setVideos(videos);
  }
}

export function refreshPanelNotes() {
  if (panelRef && panelRef.refreshNotes) {
    panelRef.refreshNotes();
  }
}

export function destroyPanel() {
  unmountPanel();
  panelRef = null;
}
