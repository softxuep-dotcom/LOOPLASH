// Rescue encounters must stay solvable with ordinary convex circles. The red
// zone is the visual contract; the larger center distance leaves enough room
// for a comfortable one-mote loop outside that zone.
export const BOMB_EXCLUSION_RADIUS = 60;
export const RESCUE_LOOP_RADIUS = 38;
export const RESCUE_CLEARANCE_GAP = 18;
export const BOMB_MOTE_MIN_DISTANCE = BOMB_EXCLUSION_RADIUS + RESCUE_LOOP_RADIUS + RESCUE_CLEARANCE_GAP;
