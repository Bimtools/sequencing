import { all, fork } from "redux-saga/effects";
import drawingSaga from "./drawing/saga";
function* rootSaga() {
  yield all([
    fork(drawingSaga),
  ]);
}
export default rootSaga;
