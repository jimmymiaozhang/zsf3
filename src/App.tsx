import { useState } from 'react';
import './App.css';
import Navbar from './components/Navbar';
import SidebarLeft from './components/SidebarLeft';
import SidebarRight from './components/SidebarRight';
import MapArea from './components/MapArea';

function App() {
  const [leftSidebarVisible, setLeftSidebarVisible] = useState(true);
  const [rightSidebarVisible, setRightSidebarVisible] = useState(true);

  return (
    <div className="app-shell">
      <Navbar />
      <div className="content-shell">
        <SidebarLeft isVisible={leftSidebarVisible} />
        <MapArea
          leftSidebarVisible={leftSidebarVisible}
          rightSidebarVisible={rightSidebarVisible}
          onToggleLeft={() => setLeftSidebarVisible((visible) => !visible)}
          onToggleRight={() => setRightSidebarVisible((visible) => !visible)}
        />
        <SidebarRight isVisible={rightSidebarVisible} />
      </div>
    </div>
  );
}

export default App;
