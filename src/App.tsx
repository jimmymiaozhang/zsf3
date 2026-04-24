import { useState } from 'react';
import './App.css';
import Navbar from './components/Navbar';
import SidebarLeft from './components/SidebarLeft';
import SidebarRight from './components/SidebarRight';
import MapArea from './components/MapArea';

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

  const handleToggleLayer = (layerId: MapLayerId) => {
    setMapLayers((current) => ({
      ...current,
      [layerId]: !current[layerId],
    }));
  };

  return (
    <div className="app-shell">
      <Navbar />
      <div className="content-shell">
        <SidebarLeft
          isVisible={leftSidebarVisible}
          mapLayers={mapLayers}
          onToggleLayer={handleToggleLayer}
        />
        <MapArea
          leftSidebarVisible={leftSidebarVisible}
          rightSidebarVisible={rightSidebarVisible}
          mapLayers={mapLayers}
          onToggleLeft={() => setLeftSidebarVisible((visible) => !visible)}
          onToggleRight={() => setRightSidebarVisible((visible) => !visible)}
        />
        <SidebarRight isVisible={rightSidebarVisible} />
      </div>
    </div>
  );
}

export default App;
