import logo from "./logo.svg";
import "./App.css";
import * as WorkspaceAPI from "trimble-connect-workspace-api";
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  ScissorOutlined,
  EyeInvisibleFilled,
  EyeFilled,
  MenuOutlined,
} from "@ant-design/icons";

import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Layout, Typography, List, Card, Space, Input, Button } from "antd";
import { GetFolderRequest, CreateFolderRequest } from "./store/sequence/action";
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
  const sequences = useSelector((state) => state.sequence.sequences);
  const rootFolderId = useSelector((state) => state.sequence.rootFolderId);
  const rootCommentId = useSelector((state) => state.sequence.rootCommentId);
  const [projectId, setProjectId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [step, setStep] = useState("");

  const onDragEnd = (event) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      // setItems((prev) => {
      //   const oldIndex = prev.indexOf(active.id);
      //   const newIndex = prev.indexOf(over.id);
      //   return arrayMove(prev, oldIndex, newIndex);
      // });
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
          Test
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
          <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext
              items={sequences}
              strategy={verticalListSortingStrategy}
            >
              <List
                dataSource={sequences}
                renderItem={(item, index) => (
                  <SortableItem key={item.id} id={item.id}>
                    <List.Item
                      style={{
                        marginTop: 2,
                        border: "1px solid #ccc",
                        borderRadius: 10,
                      }}
                    >
                      <MenuOutlined style={{ marginLeft: 10 }} />
                      <strong> {index + 1}. </strong>&nbsp;{item.name}
                    </List.Item>
                  </SortableItem>
                )}
              />
            </SortableContext>
          </DndContext>
        </Card>
      </Content>
    </Layout>
  );
}

export default App;
