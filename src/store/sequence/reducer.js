import * as type from "./actionTypes";
const initialState = {
  rootFolderId: null,
  rootCommentId: null,
  sequences: [],
  sequenceObjects:[],
  pending: false,
  error: null,
};
const reducers = (state = initialState, action) => {
  switch (action.type) {
    case type.CREATE_FOLDER_REQUEST:
      return {
        ...state,
        pending: true,
      };
    case type.CREATE_FOLDER_SUCCESS:
      return {
        ...state,
        pending: false,
        rootCommentId: action.payload.rootCommentId,
        sequences: [...action.payload.folders],
      };
    case type.CREATE_FOLDER_FAILURE:
      return {
        ...state,
        pending: false,
        error: action.payload,
      };
    case type.GET_FOLDER_REQUEST:
      return {
        ...state,
        pending: true,
      };
    case type.GET_FOLDER_SUCCESS:
      return {
        ...state,
        pending: false,
        rootFolderId: action.payload.folderId,
        sequences: [...action.payload.folders],
      };
    case type.GET_FOLDER_FAILURE:
      return {
        ...state,
        pending: false,
        error: action.error,
      };
    default:
      return { ...state };
  }
};
export default reducers;
