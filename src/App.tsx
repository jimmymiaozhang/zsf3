import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import Navbar from './components/Navbar';
import SidebarLeft from './components/SidebarLeft';
import SidebarRight from './components/SidebarRight';
import MapArea from './components/MapArea';
import type { LotSelectionState } from './lib/lotZoningRequirements';

const DATASET_FOLDER_PATH = '/data/test_multiple_blocks';

export type MapLayerId =
  | 'zoningMap'
  | 'zoningEnvelopes'
  | 'placeLabels'
  | 'roadLabels'
  | 'transitLabels'
  | 'poiLabels'
  | 'landmarkIconLabels'
  | 'show3dObjects';

export type MapLayerVisibilityState = Record<MapLayerId, boolean>;

export type MapDataStatus = {
  itemCount: number;
  zoningLoadError: string | null;
  isDataLoading: boolean;
};

function App() {
  const [leftSidebarVisible, setLeftSidebarVisible] = useState(false);
  const [rightSidebarVisible, setRightSidebarVisible] = useState(false);
  const [mapLayers, setMapLayers] = useState<MapLayerVisibilityState>({
    zoningMap: true,
    zoningEnvelopes: true,
    placeLabels: true,
    roadLabels: true,
    transitLabels: false,
    poiLabels: false,
    landmarkIconLabels: false,
    show3dObjects: true,
  });
  const [lotSelection, setLotSelection] = useState<LotSelectionState>({
    activeBbl: null,
    lotRequirements: null,
    lotRequirementsLoading: false,
    lotRequirementsError: null,
  });
  const [mapDataStatus, setMapDataStatus] = useState<MapDataStatus>({
    itemCount: 0,
    zoningLoadError: null,
    isDataLoading: true,
  });
  const hasAutoOpenedSidebarsRef = useRef(false);

  const handleToggleLayer = (layerId: MapLayerId) => {
    setMapLayers((current) => ({
      ...current,
      [layerId]: !current[layerId],
    }));
  };

  const handleLotSelectionChange = useCallback((next: LotSelectionState) => {
    setLotSelection(next);
  }, []);

  const handleMapDataStatusChange = useCallback((next: MapDataStatus) => {
    setMapDataStatus(next);
  }, []);

  useEffect(() => {
    if (mapDataStatus.isDataLoading || hasAutoOpenedSidebarsRef.current) {
      return;
    }

    setLeftSidebarVisible(true);
    setRightSidebarVisible(true);
    hasAutoOpenedSidebarsRef.current = true;
  }, [mapDataStatus.isDataLoading]);

  return (
    <div className="app-shell">
      <Navbar />
      <div className="content-shell">
        <SidebarLeft
          isVisible={leftSidebarVisible}
          mapLayers={mapLayers}
          datasetFolder={DATASET_FOLDER_PATH}
          itemCount={mapDataStatus.itemCount}
          activeBbl={lotSelection.activeBbl}
          zoningLoadError={mapDataStatus.zoningLoadError}
          onToggleLayer={handleToggleLayer}
          onHide={() => setLeftSidebarVisible(false)}
        />
        <MapArea
          leftSidebarVisible={leftSidebarVisible}
          rightSidebarVisible={rightSidebarVisible}
          mapLayers={mapLayers}
          onLotSelectionChange={handleLotSelectionChange}
          onMapDataStatusChange={handleMapDataStatusChange}
          onToggleLeft={() => setLeftSidebarVisible((visible) => !visible)}
          onToggleRight={() => setRightSidebarVisible((visible) => !visible)}
        />
        <SidebarRight
          isVisible={rightSidebarVisible}
          onHide={() => setRightSidebarVisible(false)}
          activeBbl={lotSelection.activeBbl}
          lotRequirements={lotSelection.lotRequirements}
          lotRequirementsLoading={lotSelection.lotRequirementsLoading}
          lotRequirementsError={lotSelection.lotRequirementsError}
        />
      </div>
    </div>
  );
}

export default App;
