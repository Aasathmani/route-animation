import React, { useEffect, useRef, useState } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/proj';
import Feature from 'ol/Feature';
import { Point } from 'ol/geom';
import { Stroke, Style, Icon } from 'ol/style';
import Draw from 'ol/interaction/Draw';

import vesselIcon from './vessel.png'; // Replace with your vessel icon path

const MapComponent = () => {
  const mapRef = useRef();
  const [map, setMap] = useState(null);
  const [vectorSource] = useState(new VectorSource());
  const [routeCoords, setRouteCoords] = useState([]);
  const [vesselFeature, setVesselFeature] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [sliderValue, setSliderValue] = useState(0);
  const [animationFrame, setAnimationFrame] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    const initialMap = new Map({
      target: mapRef.current,
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
        new VectorLayer({
          source: vectorSource,
        }),
      ],
      view: new View({
        center: fromLonLat([0, 0]), // Center on the world map
        zoom: 2,
      }),
    });

    setMap(initialMap);

    return () => {
      if (initialMap) {
        initialMap.setTarget(null);
      }
    };
  }, [vectorSource]);

  const addInteraction = () => {
    if (!map) return;

    const draw = new Draw({
      source: vectorSource,
      type: 'LineString',
    });

    draw.on('drawend', (event) => {
      const routeFeature = event.feature;
      routeFeature.setStyle(new Style({
        stroke: new Stroke({
          color: '#FF0000',
          width: 3,
        }),
      }));

      const coords = routeFeature.getGeometry().getCoordinates();
      setRouteCoords(coords);

      const vesselStyle = new Style({
        image: new Icon({
          anchor: [0.5, 0.5],
          src: vesselIcon,
          scale: 0.5,
        }),
      });

      const vessel = new Feature({
        geometry: new Point(coords[0]),
      });
      vessel.setStyle(vesselStyle);
      setVesselFeature(vessel);

      const vesselLayer = new VectorLayer({
        source: new VectorSource({
          features: [vessel],
        }),
      });
      map.addLayer(vesselLayer);
    });

    map.addInteraction(draw);
  };

  const animateVessel = (timestamp) => {
    if (!vesselFeature || routeCoords.length === 0) return;

    const speed = 300000 * 1000 / 3600; // Speed in meters per second (30 km/h)
    let start = timestamp;
    const animate = (timestamp) => {
      if (!start) start = timestamp;
      const progress = timestamp - start + elapsedTime;

      const totalLength = routeCoords.reduce((acc, curr, i) => {
        if (i === 0) return acc;
        const prev = routeCoords[i - 1];
        return acc + Math.sqrt(
          Math.pow(curr[0] - prev[0], 2) +
          Math.pow(curr[1] - prev[1], 2)
        );
      }, 0);

      const traveled = speed * (progress / 1000);
      let distance = 0;
      let index = 0;

      for (index = 0; index < routeCoords.length - 1; index++) {
        const segmentLength = Math.sqrt(
          Math.pow(routeCoords[index + 1][0] - routeCoords[index][0], 2) +
          Math.pow(routeCoords[index + 1][1] - routeCoords[index][1], 2)
        );

        if (distance + segmentLength > traveled) {
          break;
        }

        distance += segmentLength;
      }

      const currentCoord = routeCoords[index];
      const nextCoord = routeCoords[index + 1];

      if (nextCoord) {
        const segmentLength = Math.sqrt(
          Math.pow(nextCoord[0] - currentCoord[0], 2) +
          Math.pow(nextCoord[1] - currentCoord[1], 2)
        );
        const fraction = (traveled - distance) / segmentLength;
        const intermediateCoord = [
          currentCoord[0] + (nextCoord[0] - currentCoord[0]) * fraction,
          currentCoord[1] + (nextCoord[1] - currentCoord[1]) * fraction,
        ];
        vesselFeature.getGeometry().setCoordinates(intermediateCoord);

        const rotation = Math.atan2(nextCoord[1] - currentCoord[1], nextCoord[0] - currentCoord[0]);

        vesselFeature.setStyle(new Style({
          image: new Icon({
            anchor: [0.5, 0.5],
            src: vesselIcon,
            scale: 0.4,
            //rotation: rotation,
          }),
        }));

        setSliderValue((distance + (segmentLength * fraction)) / totalLength * 100);

        if (isAnimating) {
          const frame = requestAnimationFrame(animate);
          setAnimationFrame(frame);
        } else {
          setElapsedTime(progress);
        }
      }
    };

    if (isAnimating) {
      const frame = requestAnimationFrame(animate);
      setAnimationFrame(frame);
    }
  };

  const handlePlayPause = () => {
    if (isAnimating) {
      setIsAnimating(false);
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    } else {
      setIsAnimating(true);
      requestAnimationFrame(animateVessel);
    }
  };

  const handleReset = () => {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
    setIsAnimating(false);
    setElapsedTime(0);
    setSliderValue(0);
    if (vesselFeature && routeCoords.length > 0) {
      vesselFeature.getGeometry().setCoordinates(routeCoords[0]);
      vesselFeature.setStyle(new Style({
        image: new Icon({
          anchor: [0.5, 0.5],
          src: vesselIcon,
          scale: 0.4,
        }),
      }));
    }
  };

  useEffect(() => {
    if (isAnimating) {
      requestAnimationFrame(animateVessel);
    } else if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
  }, [isAnimating]);

  const handleSliderChange = (event) => {
    const value = event.target.value;
    setSliderValue(value);

    const totalLength = routeCoords.reduce((acc, curr, i) => {
      if (i === 0) return acc;
      const prev = routeCoords[i - 1];
      return acc + Math.sqrt(
        Math.pow(curr[0] - prev[0], 2) +
        Math.pow(curr[1] - prev[1], 2)
      );
    }, 0);

    const traveled = totalLength * (value / 100);
    let distance = 0;
    let index = 0;

    for (index = 0; index < routeCoords.length - 1; index++) {
      const segmentLength = Math.sqrt(
        Math.pow(routeCoords[index + 1][0] - routeCoords[index][0], 2) +
        Math.pow(routeCoords[index + 1][1] - routeCoords[index][1], 2)
      );

      if (distance + segmentLength > traveled) {
        break;
      }

      distance += segmentLength;
    }

    const currentCoord = routeCoords[index];
    const nextCoord = routeCoords[index + 1];

    if (nextCoord) {
      const segmentLength = Math.sqrt(
        Math.pow(nextCoord[0] - currentCoord[0], 2) +
        Math.pow(nextCoord[1] - currentCoord[1], 2)
      );
      const fraction = (traveled - distance) / segmentLength;
      const intermediateCoord = [
        currentCoord[0] + (nextCoord[0] - currentCoord[0]) * fraction,
        currentCoord[1] + (nextCoord[1] - currentCoord[1]) * fraction,
      ];
      vesselFeature.getGeometry().setCoordinates(intermediateCoord);

      const rotation = Math.atan2(nextCoord[1] - currentCoord[1], nextCoord[0] - currentCoord[0]);

      vesselFeature.setStyle(new Style({
        image: new Icon({
          anchor: [0.5, 0.5],
          src: vesselIcon,
          scale: 0.4,
          //rotation: rotation,
        }),
      }));
    }
  };

  return (
    <div>
      <h1>OpenLayers Map in React</h1>
      <div
        ref={mapRef}
        style={{ width: '100%', height: '500px', position: 'relative' }}
      />
      <div className="controller">
        <button onClick={addInteraction}>Draw Route</button>
        <button onClick={handlePlayPause}>
          {isAnimating ? 'Pause' : (elapsedTime > 0 ? 'Resume' : 'Play')}
        </button>
        <button onClick={handleReset}>Reset</button>
        <input
          type="range"
          min="0"
          max="100"
          value={sliderValue}
          onChange={handleSliderChange}
          disabled={isAnimating}
        />
        <div className="time-indicator">{/* Display the time as needed */}</div>
      </div>
      <style jsx>{`
        .controller {
          position: absolute;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          background: rgba(0, 0, 0, 0.7);
          padding: 10px;
          border-radius: 10px;
        }

        .controller button {
          margin-right: 10px;
          background: none;
          border: none;
          color: white;
          cursor: pointer;
        }

        .controller input[type="range"] {
          flex: 1;
          margin: 0 10px;
        }

        .controller .time-indicator {
          background: #1e90ff;
          color: white;
          padding: 5px 10px;
          border-radius: 5px;
        }
      `}</style>
    </div>
  );
};

export default MapComponent;
