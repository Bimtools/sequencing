import * as type from "./actionTypes";
const initialState = {
  rootFolderId: null,
  rootCommentId: null,
  sequences: [],
  sequenceObjects: [],
  selectedObjects: [],
  selectedGroup: null,
  pending: false,
  error: null,
};
const reducers = (state = initialState, action) => {
  switch (action.type) {
    case type.CREATE_SEQUENCE_REQUEST:
      return {
        ...state,
        pending: true,
      };
    case type.CREATE_SEQUENCE_SUCCESS:
      return {
        ...state,
        pending: false,
        rootCommentId: action.payload.rootCommentId,
        sequences: [...action.payload.sequences],
        sequenceObjects: [...action.payload.sequenceObjects],
      };
    case type.CREATE_SEQUENCE_FAILURE:
      return {
        ...state,
        pending: false,
        error: action.payload,
      };
    case type.GET_SEQUENCE_REQUEST:
      return {
        ...state,
        pending: true,
      };
    case type.GET_SEQUENCE_SUCCESS:
      return {
        ...state,
        pending: false,
        rootCommentId: action.payload.commentId,
        rootFolderId: action.payload.folderId,
        sequences: Array.isArray(action.payload.sequences)
          ? action.payload.sequences
          : [],
        sequenceObjects: Array.isArray(action.payload.sequenceObjects)
          ? action.payload.sequenceObjects
          : [],
      };
    case type.GET_SEQUENCE_FAILURE:
      return {
        ...state,
        pending: false,
        error: action.error,
      };
    case type.DELETE_SEQUENCE_REQUEST:
      return {
        ...state,
        pending: true,
      };
    case type.DELETE_SEQUENCE_SUCCESS:
      return {
        ...state,
        pending: false,
        sequences: [...action.payload.sequences],
        sequenceObjects: [...action.payload.sequenceObjects],
      };
    case type.DELETE_SEQUENCE_FAILURE:
      return {
        ...state,
        pending: false,
        error: action.error,
      };
    case type.UPDATE_COMMENT_REQUEST:
      return {
        ...state,
        pending: true,
      };
    case type.UPDATE_COMMENT_SUCCESS:
      return {
        ...state,
        pending: false,
        sequences: [...action.payload.folders],
      };
    case type.UPDATE_COMMENT_FAILURE:
      return {
        ...state,
        pending: false,
        error: action.error,
      };
    case type.SET_OBJECTS_REQUEST:
      return {
        ...state,
        pending: true,
      };
    case type.SET_OBJECTS_SUCCESS:
      const remaining = state.sequenceObjects.filter(
        (x) => x.folderId !== action.payload.folderId,
      );
      return {
        ...state,
        pending: false,
        sequenceObjects: [...remaining, action.payload],
      };

    case type.SET_OBJECTS_FAILURE:
      return {
        ...state,
        pending: false,
        error: action.error,
      };
    case type.SELECT_OBJECTS_REQUEST:
      return {
        ...state,
        pending: true,
      };
    case type.SELECT_OBJECTS_SUCCESS:
      const objects = action.payload?.objects ?? [];
      const selectedGroup = action.payload?.folderId ?? null;
      return {
        ...state,
        selectedObjects: objects,
        selectedGroup: selectedGroup,
        pending: false,
      };

    case type.SELECT_OBJECTS_FAILURE:
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
