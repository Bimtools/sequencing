import axios from "axios";
import {
  all,
  call,
  put,
  takeLatest,
  takeEvery,
  fork,
} from "redux-saga/effects";
import {
  GetSubPlansSuccess,
  GetSubPlansFailure,
  CreateSubPlanSuccess,
  CreateSubPlanFailure,
  DeleteSubPlanFailure,
  DeleteSubPlanSuccess,
  UpdateSubPlanSuccess,
  UpdateSubPlanFailure,
  UpdateCommentSuccess,
  UpdateCommentFailure,
  SetObjectsSuccess,
  SetObjectsFailure,
  GetSourceSequenceSuccess,
  GetSourceSequenceFailure,
  GetPlanSuccess,
  GetPlanFailure,
  CreatePlanSuccess,
  CreatePlanFailure,
  UpdatePlanSuccess,
  UpdatePlanFailure,
  DeletePlanSuccess,
  DeletePlanFailure,
} from "./action";
import instance from "../../interceptors/axios";
function* getPlansSaga(action) {
  try {
    //Check Sequence Folder
    const getFolderUrl = `/folders/by_path?path=${action.payload.projectName}&projectId=${action.payload.projectId}`;
    const response = yield call(instance.get, getFolderUrl);
    const folders = response.data.filter((x) => x.name === "Sequence");
    if (folders.length === 0) {
      const insertFolderUrl = `/folders`;
      const insertFolderResponse = yield call(instance.post, insertFolderUrl, {
        name: "Sequence",
        parentId: response.data[0].parentId,
      });
      yield put(
        GetPlanSuccess({
          folderId: insertFolderResponse.data.id,
          plans: [],
        }),
      );
    } else {
      //Get comment in the sequence folder
      const getCommentUrl = `/comments?objectId=${folders[0].id}&objectType=FOLDER`;
      const commentResponse = yield call(instance.get, getCommentUrl);
      const plans = JSON.parse(
        commentResponse.data.length > 0
          ? commentResponse.data[0].description
          : "[]",
      );
      console.log(plans);
      yield put(
        GetPlanSuccess({
          rootCommentId:
            commentResponse.data.length > 0 ? commentResponse.data[0].id : null,
          folderId: folders[0].id,
          plans: plans,
        }),
      );
    }
  } catch (error) {
    console.error("Error fetching folder:", error);
    yield put(GetPlanFailure(error.message));
  }
}
function* createPlanSaga(action) {
  const insertFolderUrl = `/folders`;
  console.log(action.payload);
  const insertFolderBody = {
    name: action.payload.name,
    parentId: action.payload.rootFolderId,
  };
  const insertFolderResponse = yield call(
    instance.post,
    insertFolderUrl,
    insertFolderBody,
  );
  try {
    const newPlan = {
      id: insertFolderResponse.data.id,
      name: action.payload.name,
    };
    const newPlans = [...action.payload.plans, newPlan];
    console.log(newPlans);
    if (action.payload.rootCommentId) {
      //Update comment with new phase list
      const updateCommentUrl = `/comments/${action.payload.rootCommentId}`;
      yield call(instance.patch, updateCommentUrl, {
        description: JSON.stringify(newPlans),
      });
      yield put(
        CreatePlanSuccess({
          rootCommentId: action.payload.rootCommentId,
          plans: [...action.payload.plans, newPlan],
        }),
      );
    } else {
      //Create comment with phase list
      const createCommentUrl = `/comments`;
      const createCommentBody = {
        objectId: action.payload.rootFolderId,
        objectType: "FOLDER",
        description: JSON.stringify(newPlans),
      };
      console.log(createCommentBody);
      const responseInsertComment = yield call(
        instance.post,
        createCommentUrl,
        createCommentBody,
      );
      yield put(
        CreatePlanSuccess({
          rootCommentId: responseInsertComment.data.id,
          plans: [...action.payload.plans, newPlan],
        }),
      );
    }
  } catch (error) {
    console.error("Error creating folder:", error);
    yield put(CreatePlanFailure(error.message));
  }
}
function* updatePlanSaga(action) {
  try {
    //Update comment with new sequence list
    const updateCommentUrl = `/comments/${action.payload.commentId}`;
    yield call(instance.patch, updateCommentUrl, {
      description: JSON.stringify(action.payload.plans),
    });
    yield put(
      UpdatePlanSuccess({
        plans: [...action.payload.plans],
      }),
    );
  } catch (error) {
    console.error("Error updating comment:", error);
    yield put(UpdatePlanFailure(error.message));
  }
}
function* deletePlanSaga(action) {
  try {
    //Delete folder
    const deleteFolderUrl = `/folders/${action.payload.folderId}`;
    var deleteStatus = false;
    try {
      const deleteFolderResponse = yield call(instance.delete, deleteFolderUrl);
      console.log("deleteFolderResponse", deleteFolderResponse.status);
      deleteStatus = deleteFolderResponse.status === 204;
    } catch (error) {
      deleteStatus = error.message.includes("404");
    }
    if (deleteStatus) {
      const newPlans = action.payload.plans.filter(
        (x) => x.id !== action.payload.folderId,
      );

      //Update comment with new sequence list
      const updateCommentUrl = `/comments/${action.payload.rootCommentId}`;
      yield call(instance.patch, updateCommentUrl, {
        description: JSON.stringify(newPlans),
      });
      yield put(
        DeletePlanSuccess({
          plans: [...newPlans],
        }),
      );
    } else {
      yield put(DeletePlanFailure("Failed to delete plan"));
    }
  } catch (error) {
    console.error("Error updating comment:", error);
    yield put(DeletePlanFailure(error.message));
  }
}
function* createSubPlanSaga(action) {
  const insertFolderUrl = `/folders`;
  console.log(action.payload);
  const insertFolderBody = {
    name: action.payload.name,
    parentId: action.payload.phaseFolderId,
  };
  const insertFolderResponse = yield call(
    instance.post,
    insertFolderUrl,
    insertFolderBody,
  );
  try {
    const newSubPlan = {
      id: insertFolderResponse.data.id,
      planId: action.payload.phaseFolderId,
      name: action.payload.name,
      color: action.payload.color,
      check: action.payload.check,
    };
    const prevSubPlans = action.payload.subPlans.filter(
      (x) => x && x.planId === newSubPlan.planId,
    );
    const newSubPlans = [...prevSubPlans, newSubPlan];
    console.log(newSubPlans);
    if (action.payload.phaseCommentId) {
      //Update comment with new sequence list
      const updateCommentUrl = `/comments/${action.payload.phaseCommentId}`;
      yield call(instance.patch, updateCommentUrl, {
        description: JSON.stringify(newSubPlans),
      });
      yield put(
        CreateSubPlanSuccess({
          phaseCommentId: action.payload.phaseCommentId,
          subPlans: [...action.payload.subPlans, newSubPlan],
          sequenceObjects: [
            ...action.payload.sequenceObjects,
            {
              folderId: newSubPlan.id,
              objectIds: [],
            },
          ],
        }),
      );
    } else {
      //Create comment with sequence list
      const createCommentUrl = `/comments`;
      const createCommentBody = {
        objectId: action.payload.phaseFolderId,
        objectType: "FOLDER",
        description: JSON.stringify(newSubPlans),
      };
      const responseInsertComment = yield call(
        instance.post,
        createCommentUrl,
        createCommentBody,
      );
      yield put(
        CreateSubPlanSuccess({
          phaseCommentId: responseInsertComment.data.id,
          subPlans: [...action.payload.subPlans, newSubPlan],
          sequenceObjects: [
            ...action.payload.sequenceObjects,
            {
              folderId: newSubPlan.id,
              objectIds: [],
            },
          ],
        }),
      );
    }
  } catch (error) {
    console.error("Error creating folder:", error);
    yield put(CreateSubPlanFailure(error.message));
  }
}
function* updateSubPlanSaga(action) {
  try {
    //Get comment in the folder
    const getCommentUrl = `/comments?objectId=${action.payload.subPlans[0].planId}&objectType=FOLDER`;
    const commentResponse = yield call(instance.get, getCommentUrl);
    const comments = commentResponse.data;
    //Update comment with new sequence list
    const updateCommentUrl = `/comments/${comments[0].id}`;
    yield call(instance.patch, updateCommentUrl, {
      description: JSON.stringify(action.payload.subPlans),
    });
    yield put(
      UpdateSubPlanSuccess({
        subPlans: [...action.payload.subPlans],
      }),
    );
  } catch (error) {
    console.error("Error updating comment:", error);
    yield put(UpdateSubPlanFailure(error.message));
  }
}
function* getSubPlansSaga(action) {
  try {
    //Get comment in the sequence folder
    const getCommentUrl = `/comments?objectId=${action.payload.folderId}&objectType=FOLDER`;
    const commentResponse = yield call(instance.get, getCommentUrl);

    const subPlans = JSON.parse(
      commentResponse.data.length > 0
        ? commentResponse.data[0].description
        : "[]",
    );
    console.log("subPlans", subPlans);
    const sequenceObjects = [];
    for (const subPlan of subPlans) {
      const getSequenceCommentUrl = `/comments?objectId=${subPlan.id}&objectType=FOLDER`;
      const sequenceCommentResponse = yield call(
        instance.get,
        getSequenceCommentUrl,
      );
      console.log("sequenceCommentResponse", sequenceCommentResponse);
      const contents = sequenceCommentResponse.data.map((x) => {
        return {
          id: x.description.split("tuan")[0],
          content: x.description.split("tuan")[1],
        };
      });
      contents.sort((a, b) => parseInt(a.id) - parseInt(b.id));
      const content = contents.map((x) => x.content).join("");
      const objects = JSON.parse(content.length > 0 ? content : null);
      sequenceObjects.push(objects);
    }
    console.log("sequenceObjects", sequenceObjects);
    yield put(
      GetSubPlansSuccess({
        phaseCommentId:
          commentResponse.data.length > 0 ? commentResponse.data[0].id : null,
        phaseFolderId: action.payload.folderId,
        subPlans: subPlans,
        sequenceObjects: sequenceObjects,
      }),
    );
  } catch (error) {
    console.error("Error fetching folder:", error);
    yield put(GetSubPlansFailure(error.message));
  }
}
function* deleteSubPlanSaga(action) {
  try {
    console.log("deleteSubPlanSaga", action.payload);
    //Delete folder
    const deleteFolderUrl = `/folders/${action.payload.subPlanId}`;
    var deleteStatus = false;
    try {
      const deleteFolderResponse = yield call(instance.delete, deleteFolderUrl);
      console.log("deleteFolderResponse", deleteFolderResponse.status);
      deleteStatus = deleteFolderResponse.status === 204;
    } catch (error) {
      deleteStatus = error.message.includes("404");
    }
    if (deleteStatus) {
      const newSubPlans = action.payload.subPlans.filter(
        (x) => x && x.id !== action.payload.subPlanId,
      );
      const newSequenceObjects = action.payload.sequenceObjects.filter(
        (x) => x && x.folderId !== action.payload.subPlanId,
      );
      //Get comment in the folder
      const getCommentUrl = `/comments?objectId=${action.payload.planId}&objectType=FOLDER`;
      const commentResponse = yield call(instance.get, getCommentUrl);
      const comments = commentResponse.data;

      //Update comment with new sequence list
      const updateCommentUrl = `/comments/${comments[0].id}`;
      yield call(instance.patch, updateCommentUrl, {
        description: JSON.stringify(newSubPlans),
      });
      yield put(
        DeleteSubPlanSuccess({
          subPlans: [...newSubPlans],
          sequenceObjects: [...newSequenceObjects],
        }),
      );
    } else {
      yield put(DeleteSubPlanFailure("Failed to delete sub plan"));
    }
  } catch (error) {
    console.error("Error updating comment:", error);
    yield put(DeleteSubPlanFailure(error.message));
  }
}
function* getSourceSequenceSaga(action) {
  try {
    //Get comment in the sequence folder
    const getCommentUrl = `/comments?objectId=${action.payload.folderId}&objectType=FOLDER`;
    const commentResponse = yield call(instance.get, getCommentUrl);

    const sequences = JSON.parse(
      commentResponse.data.length > 0
        ? commentResponse.data[0].description
        : "[]",
    );

    yield put(
      GetSourceSequenceSuccess({
        sequences: sequences,
      }),
    );
  } catch (error) {
    console.error("Error fetching folder:", error);
    yield put(GetSourceSequenceFailure(error.message));
  }
}
function* copySequenceSaga(action) {
  try {
    const newSequences = [];

    for (const sequence of action.payload.sequencesToBeCopied) {
      const insertFolderUrl = "/folders";
      const insertFolderBody = {
        name: sequence.name,
        parentId: action.payload.phaseFolderId,
      };

      const insertFolderResponse = yield call(
        instance.post,
        insertFolderUrl,
        insertFolderBody,
      );

      newSequences.push({
        id: insertFolderResponse.data.id,
        name: sequence.name,
        color: sequence.color,
      });
    }
    const updatedSequences = [...action.payload.sequences, ...newSequences];
    if (action.payload.phaseCommentId) {
      const updateCommentUrl = `/comments/${action.payload.commentId}`;
      yield call(instance.patch, updateCommentUrl, {
        description: JSON.stringify(updatedSequences),
      });
      yield put(
        UpdateCommentSuccess({
          folders: updatedSequences,
          phaseCommentId: action.payload.phaseCommentId,
        }),
      );
    } else {
      //Create comment with sequence list
      const createCommentUrl = `/comments`;
      const createCommentBody = {
        objectId: action.payload.phaseFolderId,
        objectType: "FOLDER",
        description: JSON.stringify(updatedSequences),
      };
      const responseInsertComment = yield call(
        instance.post,
        createCommentUrl,
        createCommentBody,
      );

      yield put(
        UpdateCommentSuccess({
          folders: updatedSequences,
          phaseCommentId: responseInsertComment.data.id,
        }),
      );
    }
  } catch (error) {
    console.error("Error updating comment:", error);
    const message = error?.message ?? "Something went wrong";
    yield put(UpdateCommentFailure(message));
  }
}
function* updateCommentSaga(action) {
  try {
    //Get comment in the folder
    const getCommentUrl = `/comments?objectId=${action.payload.folderId}&objectType=FOLDER`;
    const commentResponse = yield call(instance.get, getCommentUrl);
    const comments = commentResponse.data;
    //Update comment with new sequence list
    const updateCommentUrl = `/comments/${comments[0].id}`;
    yield call(instance.patch, updateCommentUrl, {
      description: JSON.stringify(action.payload.subPlans),
    });
    yield put(
      UpdateCommentSuccess({
        subPlans: [...action.payload.subPlans],
      }),
    );
  } catch (error) {
    console.error("Error updating comment:", error);
    yield put(UpdateCommentFailure(error.message));
  }
}
function* setObjectsSaga(action) {
  try {
    console.log("Set objects saga", action.payload);
    const subPlanId = action.payload.subPlanId;
    console.log(subPlanId);
    //Get all comments
    const getCommentUrl = `/comments?objectId=${subPlanId}&objectType=FOLDER`;
    const commentResponse = yield call(instance.get, getCommentUrl);

    for (const comment of commentResponse.data) {
      const deleteCommentUrl = `/comments/${comment.id}`;
      console.log("Deleting comment with id", comment.id);
      yield call(instance.delete, deleteCommentUrl);
    }

    //Create comment with sequence list
    const stringContent = JSON.stringify(action.payload);
    var startIndex = 0;
    var step = 800;
    var chunkIndex = 0;
    const createCommentUrl = `/comments`;
    while (startIndex < stringContent.length) {
      const chunk = stringContent.substring(startIndex, startIndex + step);
      startIndex += step;
      chunkIndex++;
      const createCommentBody = {
        objectId: subPlanId,
        objectType: "FOLDER",
        description: chunkIndex + "tuan" + chunk,
      };
      const responseInsertComment = yield call(
        instance.post,
        createCommentUrl,
        createCommentBody,
      );
    }
    yield put(SetObjectsSuccess(action.payload));
  } catch (error) {
    console.error("Error creating folder:", error);
    yield put(SetObjectsFailure(error.message));
  }
}

function* sequenceSaga() {
  yield takeEvery("GET_PLAN_REQUEST", getPlansSaga);
  yield takeEvery("CREATE_PLAN_REQUEST", createPlanSaga);
  yield takeEvery("UPDATE_PLAN_REQUEST", updatePlanSaga);
  yield takeEvery("DELETE_PLAN_REQUEST", deletePlanSaga);
  yield takeEvery("GET_SUBPLAN_REQUEST", getSubPlansSaga);
  yield takeEvery("UPDATE_SUBPLAN_REQUEST", updateSubPlanSaga);
  yield takeEvery("CREATE_SUBPLAN_REQUEST", createSubPlanSaga);
  yield takeEvery("DELETE_SUBPLAN_REQUEST", deleteSubPlanSaga);
  yield takeEvery("UPDATE_COMMENT_REQUEST", updateCommentSaga);
  yield takeEvery("GET_SOURCE_SEQUENCE_REQUEST", getSourceSequenceSaga);
  yield takeEvery("COPY_SEQUENCE_REQUEST", copySequenceSaga);
  yield takeEvery("SET_OBJECTS_REQUEST", setObjectsSaga);
}
export default sequenceSaga;
