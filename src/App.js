import logo from "./logo.svg";
import "./App.css";
import * as WorkspaceAPI from "trimble-connect-workspace-api";
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  MenuOutlined,
  DeleteFilled,
  PlusOutlined,
  MinusOutlined,
} from "@ant-design/icons";

import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Layout,
  Typography,
  List,
  Card,
  Input,
  Button,
  Popconfirm,
} from "antd";
import {
  GetFolderRequest,
  CreateFolderRequest,
  UpdateCommentRequest,
  DeleteFolderRequest,
  SetObjectsRequest
} from "./store/sequence/action";
const { Header, Content } = Layout;
const { Title, Text } = Typography;

function SortableItem({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: "grab",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

function App() {
  const dispatch = useDispatch();
  const sequenceState = useSelector((state) => state.sequence);
  const sequences = useSelector((state) => state.sequence.sequences);
  const rootFolderId = useSelector((state) => state.sequence.rootFolderId);
  const rootCommentId = useSelector((state) => state.sequence.rootCommentId);
  const [projectId, setProjectId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [step, setStep] = useState("");

  const onDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const newArray = (prev) => {
        const oldIndex = prev.findIndex((x) => x.id === active.id);
        const newIndex = prev.findIndex((x) => x.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      };
      const newSequences = newArray(sequences);
      dispatch(
        UpdateCommentRequest({
          commentId: rootCommentId,
          sequences: newSequences,
        }),
      );
    }
  };

  useEffect(() => {
    async function fetchStatus() {
      const tcapi = await WorkspaceAPI.connect(window.parent);
      const token = await tcapi.extension.requestPermission("accesstoken");
      window.localStorage.setItem("trimbleToken", token);
      const project = await tcapi.project.getProject();
      setProjectId(project.id);
      setProjectName(project.name);
      dispatch(
        GetFolderRequest({
          projectId: project.id,
          projectName: project.name,
        }),
      );
    }
    fetchStatus();
  }, []);

  React.useEffect(() => {}, []);
  return (
    <Layout style={{ height: "100vh" }}>
      <Header style={{ background: "#fff", height: "auto" }}>
        <Title level={4} style={{ margin: 0, alignContent: "center" }}>
          Sequencing
        </Title>
      </Header>
      <Content>
        <Card>
          <div style={{ display: "flex", width: "100%", gap: 5 }}>
            <Input
              style={{ flex: 1 }}
              placeholder="Enter Step"
              value={step}
              onChange={(e) => setStep(e.target.value)}
            />
            <Button
              type="primary"
              onClick={() => {
                dispatch(
                  CreateFolderRequest({
                    name: step,
                    color: "#fff",
                    rootFolderId: rootFolderId,
                    rootCommentId: rootCommentId,
                    sequences: sequences,
                  }),
                );
              }}
            >
              Create
            </Button>
          </div>
          <List
            loading={sequenceState.pending}
            dataSource={sequences}
            renderItem={(item, index) => (
              <List.Item
                style={{
                  marginTop: 2,
                  border: "1px solid #ccc",
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingRight: 12,
                }}
                occlick={() => {
                  console.log("click step", item);
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <MenuOutlined style={{ marginLeft: 10 }} />
                  <strong>{index + 1}. </strong>
                  <span>{item.name}</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Button
                    type="text"
                    icon={<PlusOutlined />}
                    onClick={async () => {
                      const tcapi = await WorkspaceAPI.connect(window.parent);
                      const selection = await tcapi.viewer.getSelection();
                      const selectedObjects = selection.map((obj) => {
                        return {
                          modelId: obj.modelId,
                          objectIds: obj.objectRuntimeIds,
                        };
                      });
                      const setObjectsBody = {
                        folderId: item.id,
                        objectIds: selectedObjects,
                      };
                      console.log("setObjectsBody", setObjectsBody);
                      dispatch(SetObjectsRequest(setObjectsBody));
                    }}
                  />
                  <Popconfirm
                    title="Delete the step"
                    description="Are you sure to delete this step?"
                    onConfirm={() => {
                      const deleteSequenceBody = {
                        rootCommentId: rootCommentId,
                        sequences: sequences,
                        folderId: item.id,
                      };
                      console.log("deleteSequenceBody", deleteSequenceBody);
                      dispatch(DeleteFolderRequest(deleteSequenceBody));
                    }}
                    okText="Yes"
                    cancelText="No"
                  >
                    <Button danger type="text" icon={<DeleteFilled />} />
                  </Popconfirm>
                </div>
              </List.Item>
            )}
          />
        </Card>
      </Content>
    </Layout>
  );
}

export default App;
