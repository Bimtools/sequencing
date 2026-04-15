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
  CreateFolderSuccess,
  DeleteFolderSuccess,
  GetFolderSuccess,
  CreateFolderFailure,
  DeleteFolderFailure,
  GetFolderFailure,
} from "./action";
import instance from "../../interceptors/axios";

function* getFolderSaga(action) {
  //Check Sequence Folder
  const getFolderUrl = `/folders/by_path?path=${action.payload.projectName}&projectId=${action.payload.projectId}`;
  const response = yield call(instance.get, getFolderUrl);
  const folders = response.data.filter((x) => x.name === "Sequence");
  if (folders.length == 0) {
    const insertFolderUrl = `/folders`;
    const insertFolderResponse = yield call(instance.post, insertFolderUrl, {
      name: "Sequence",
      parentId: response.data[0].parentId,
    });
    yield put(
      GetFolderSuccess({
        folderId: insertFolderResponse.id,
        folders: [],
      }),
    );
  } else {
    //Get comment in the sequence folder
    const getCommentUrl = `/comments?objectId=${folders[0].id}&objectType=FOLDER`;
    const commentResponse = yield call(instance.get, getCommentUrl);
    console.log(commentResponse.data);
    const sequences = JSON.parse(
      commentResponse.data.length > 0
        ? commentResponse.data[0].description
        : "[]",
    );
    console.log(sequences);
    yield put(
      GetFolderSuccess({
        commentId:
          commentResponse.data.length > 0 ? commentResponse.data[0].id : null,
        folderId: folders[0].id,
        folders: sequences,
      }),
    );
  }
}
function* createFolderSaga(action) {
  const insertFolderUrl = `/folders`;
  console.log(action.payload);
  const insertFolderBody = {
    name: action.payload.name + "_" + action.payload.color,
    parentId: action.payload.rootFolderId,
  };
  const insertFolderResponse = yield call(
    instance.post,
    insertFolderUrl,
    insertFolderBody,
  );
  try {
    const newSequence = {
      id: insertFolderResponse.data.id,
      name: action.payload.name,
      color: action.payload.color,
    };
    const newSequences = [...action.payload.sequences, newSequence];
    console.log(newSequences);
    if (action.payload.rootCommentId) {
      //Update comment with new sequence list
      const updateCommentUrl = `/comments/${action.payload.rootCommentId}`;
      yield call(instance.patch, updateCommentUrl, {
        description: JSON.stringify(newSequences),
      });
      yield put(
        CreateFolderSuccess({
          rootCommentId: action.payload.rootCommentId,
          folders: [...action.payload.sequences, newSequence],
        }),
      );
    } else {
      //Create comment with sequence list
      const createCommentUrl = `/comments`;
      const createCommentBody = {
        objectId: action.payload.rootFolderId,
        objectType: "FOLDER",
        description: JSON.stringify(newSequences),
      };
      console.log(createCommentBody);
      const responseInsertComment = yield call(
        instance.post,
        createCommentUrl,
        createCommentBody,
      );
      yield put(
        CreateFolderSuccess({
          rootCommentId: responseInsertComment.data.id,
          folders: [...action.payload.sequences, newSequence],
        }),
      );
    }
  } catch (error) {
    console.error("Error creating folder:", error);
    yield put(CreateFolderFailure(error.message));
  }
}

function* sequenceSaga() {
  yield takeEvery("CREATE_FOLDER_REQUEST", createFolderSaga);
  yield takeEvery("GET_FOLDER_REQUEST", getFolderSaga);
}
export default sequenceSaga;
