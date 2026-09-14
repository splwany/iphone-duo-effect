import { useEffect } from "react";
import { Preview } from "./components/Preview";
import { Controls } from "./components/Controls";
import { mountExperience } from "./engine/experience";
export function App() {
  useEffect(mountExperience, []);
  return (
    <>
      <header>
        <div>
          <span className="mark">◐</span> 折光 <small>TILT TO FOLD</small>
        </div>
        <button id="immersive" className="quiet">
          沉浸体验 ↗
        </button>
      </header>
      <Preview />
      <Controls />
    </>
  );
}
