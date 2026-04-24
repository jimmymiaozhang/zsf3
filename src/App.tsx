import { useCallback, useState } from 'react';
import './App.css';
import Navbar from './components/Navbar';
import SidebarLeft from './components/SidebarLeft';
import SidebarRight from './components/SidebarRight';
import MapArea from './components/MapArea';
import type { LotSelectionState } from './lib/lotZoningRequirements';

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

function App() {
  const [leftSidebarVisible, setLeftSidebarVisible] = useState(true);
  const [rightSidebarVisible, setRightSidebarVisible] = useState(true);
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

  const handleToggleLayer = (layerId: MapLayerId) => {
    setMapLayers((current) => ({
      ...current,
      [layerId]: !current[layerId],
    }));
  };

  const handleLotSelectionChange = useCallback((next: LotSelectionState) => {
    setLotSelection(next);
  }, []);

  return (
    <div className="app-shell">
      <Navbar />
      <div className="content-shell">
        <SidebarLeft
          isVisible={leftSidebarVisible}
          mapLayers={mapLayers}
          onToggleLayer={handleToggleLayer}
          onHide={() => setLeftSidebarVisible(false)}
        />
        <MapArea
          leftSidebarVisible={leftSidebarVisible}
          rightSidebarVisible={rightSidebarVisible}
          mapLayers={mapLayers}
          activeBbl={lotSelection.activeBbl}
          onLotSelectionChange={handleLotSelectionChange}
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
