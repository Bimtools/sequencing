import { combineReducers } from "redux";
import drawingReducer from "./drawing/reducer";
const rootReducer = combineReducers({
  drawing: drawingReducer,
});
export default rootReducer;
