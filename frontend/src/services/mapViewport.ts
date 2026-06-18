/** État global de la carte — survit aux re-rendus React sans reset du zoom. */
let viewportLockedByUser = false;
let initialAutoFitDone = false;

export const lockMapViewport = (): void => {
    viewportLockedByUser = true;
};

export const isMapViewportLocked = (): boolean => viewportLockedByUser;

export const shouldRunInitialAutoFit = (): boolean =>
    !viewportLockedByUser && !initialAutoFitDone;

export const markInitialAutoFitDone = (): void => {
    initialAutoFitDone = true;
};

/** Réinitialise au démontage de la page carte (prochaine visite = un seul auto-fit). */
export const resetMapViewportState = (): void => {
    viewportLockedByUser = false;
    initialAutoFitDone = false;
};
