import type { ComponentType } from 'react';
import { ApartmentScene } from './ApartmentScene';
import { CloudScene } from './CloudScene';
import { ElevatorScene } from './ElevatorScene';
import { HotelScene } from './HotelScene';
import { JourneyLights } from './JourneyLights';
import { WatchScene } from './WatchScene';
import { WindowScene } from './WindowScene';
import { YachtScene } from './YachtScene';
import { WorldScene } from './WorldScene';

/**
 * Scenes of the journey, mounted one by one while loading.
 * All of them share one camera, one world space and one timeline.
 */
export const SCENES: ComponentType[] = [WorldScene, JourneyLights, WindowScene, CloudScene, HotelScene, ElevatorScene, ApartmentScene, YachtScene, WatchScene];
