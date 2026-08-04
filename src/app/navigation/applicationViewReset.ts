export type ApplicationViewResetSteps = {
  closeOverlays: () => void;
  resetTransactionsView: () => void;
  resetCardsView: () => void;
  resetAnalysisView: () => void;
  resetProjectionView: () => void;
  navigateHome: () => void;
};

export function runApplicationViewReset(steps: ApplicationViewResetSteps) {
  steps.closeOverlays();
  steps.resetTransactionsView();
  steps.resetCardsView();
  steps.resetAnalysisView();
  steps.resetProjectionView();
  steps.navigateHome();
}
