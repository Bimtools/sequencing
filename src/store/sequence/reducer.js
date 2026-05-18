import * as type from "./actionTypes";
const initialState = {
  rootFolderId: null,
  rootCommentId: null,
  phaseFolderId: null,
  phaseCommentId: null,
  phases: [],
  sequences: [],
  sequenceObjects: [],
  selectedObjects: [],
  selectedGroup: null,
  pending: false,
  error: null,
};
const reducers = (state = initialState, action) => {
  switch (action.type) {
    case type.CREATE_PHASE_REQUEST:
      return {
        ...state,
        pending: true,
      };
    case type.CREATE_PHASE_SUCCESS:
      return {
        ...state,
        pending: false,
        rootCommentId: action.payload.rootCommentId,
        phases: [...action.payload.phases],
      };
    case type.CREATE_PHASE_FAILURE:
      return {
        ...state,
        pending: false,
        error: action.payload,
      };
    case type.UPDATE_PHASE_REQUEST:
      return {
        ...state,
        pending: true,
      };
    case type.UPDATE_PHASE_SUCCESS:
      return {
        ...state,
        pending: false,
        phases: [...action.payload.phases],
      };
    case type.UPDATE_PHASE_FAILURE:
      return {
        ...state,
        pending: false,
        error: action.payload,
      };
    case type.GET_PHASE_REQUEST:
      return {
        ...state,
        pending: true,
      };
    case type.GET_PHASE_SUCCESS:
      return {
        ...state,
        pending: false,
        rootCommentId: action.payload.rootCommentId,
        rootFolderId: action.payload.folderId,
        phases: Array.isArray(action.payload.phases)
          ? action.payload.phases
          : [],
      };
    case type.GET_PHASE_FAILURE:
      return {
        ...state,
        pending: false,
        error: action.error,
      };
    case type.DELETE_PHASE_REQUEST:
      return {
        ...state,
        pending: true,
      };
    case type.DELETE_PHASE_SUCCESS:
      return {
        ...state,
        pending: false,
        phases: [...action.payload.phases],
        sequences: [],
        sequenceObjects: [],
        selectedObjects: [],
      };
    case type.DELETE_PHASE_FAILURE:
      return {
        ...state,
        pending: false,
        error: action.error,
      };
    case type.UPDATE_PHASE_REQUEST:
      return {
        ...state,
        pending: true,
      };
    case type.UPDATE_PHASE_SUCCESS:
      return {
        ...state,
        pending: false,
        phases: [...action.payload.phases],
      };
    case type.UPDATE_PHASE_FAILURE:
      return {
        ...state,
        pending: false,
        error: action.error,
      };
    case type.CREATE_SEQUENCE_REQUEST:
      return {
        ...state,
        pending: true,
      };
    case type.CREATE_SEQUENCE_SUCCESS:
      return {
        ...state,
        pending: false,
        phaseCommentId: action.payload.phaseCommentId,
        sequences: [...action.payload.sequences],
        sequenceObjects: [...action.payload.sequenceObjects],
      };
    case type.CREATE_SEQUENCE_FAILURE:
      return {
        ...state,
        pending: false,
        error: action.payload,
      };
    case type.UPDATE_SEQUENCE_REQUEST:
      return {
        ...state,
        pending: true,
      };
    case type.UPDATE_SEQUENCE_SUCCESS:
      return {
        ...state,
        pending: false,
        sequences: [...action.payload.sequences],
      };
    case type.UPDATE_SEQUENCE_FAILURE:
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
        phaseFolderId: action.payload.phaseFolderId,
        phaseCommentId: action.payload.phaseCommentId,
        sequences: Array.isArray(action.payload.sequences)
          ? action.payload.sequences
          : [],
        sequenceObjects: Array.isArray(action.payload.sequenceObjects)
          ? action.payload.sequenceObjects
          : [],
        selectedObjects: [],
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
        selectedObjects: [],
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
        (x) => x && x.folderId !== action.payload.folderId,
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
