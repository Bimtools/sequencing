import logo from "./logo.svg";
import "./App.css";
import * as WorkspaceAPI from "trimble-connect-workspace-api";
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  GetDrawingRequest,
  UpdateViewVisibilityRequest,
  GetTrbModelRequest,
  GetAnnIdRequest,
  ShowAnnRequest,
} from "./store/drawing/action";
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

import { Layout, Typography, List, Card } from "antd";
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
  const views = useSelector((state) => state.drawing.payload);
  const trimBimModels = useSelector((state) => state.drawing.trbModels);
  const annIds = useSelector((state) => state.drawing.annIds);
  const showAnn = useSelector((state) => state.drawing.showAnn);
  const loading = useSelector((state) => state.drawing.pending);
  const [asm, setAsm] = useState();
  const [modelId, setModelId] = useState();

  const [items, setItems] = useState([
    "First task",
    "Second task",
    "Third task",
    "Fourth task",
  ]);

  const onDragEnd = (event) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setItems((prev) => {
        const oldIndex = prev.indexOf(active.id);
        const newIndex = prev.indexOf(over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  async function fetchData() {
    const tcapi = await WorkspaceAPI.connect(window.parent);
    const token = await tcapi.extension.requestPermission("accesstoken");
    window.localStorage.setItem("trimbleToken", token);
    const url = window.location.href;
    const propertyString = url.split("?")[1];
    const ifcGuid = propertyString?.split("ibim")[0];
    const fId = propertyString?.split("ibim")[1];
    if (!ifcGuid) {
      return;
    }
    if (ifcGuid.length !== 22) {
      return;
    }
    if (!fId) {
      return;
    }
    dispatch(
      GetDrawingRequest({
        id: fId,
      }),
    );

    var models;
    do {
      models = await tcapi.viewer.getModels();
    } while (models === undefined || models.length === 0);
    var asm;
    var modelId;
    for (const model of models) {
      const modelName = model.name;
      if (modelName.indexOf(".trb") >= 0) {
        console.log(modelName);
        dispatch(
          GetAnnIdRequest({
            name: model.name,
            modelId: model.id,
          }),
        );
      }
    }
    for (const model of models) {
      const modelName = model.name;
      if (modelName.indexOf(".ifc") >= 0 || modelName.indexOf(".tekla") >= 0) {
        const loadedModel = await tcapi.viewer.getLoadedModel(model.id);
        console.log(loadedModel);
        if (loadedModel === undefined) {
          await tcapi.viewer.toggleModel(model.id, true, true);
        }
        var modelObjects;
        do {
          modelObjects = await tcapi.viewer.getObjects();
        } while (modelObjects === undefined || modelObjects.length === 0);
        const runtimeIds = await tcapi.viewer.convertToObjectRuntimeIds(
          model.id,
          [ifcGuid],
        );
        if (
          runtimeIds !== undefined &&
          runtimeIds.length > 0 &&
          runtimeIds[0] >= 0
        ) {
          asm = runtimeIds[0];
          modelId = model.id;
          break;
        }
      }
    }
    setAsm(asm);
    setModelId(modelId);
    await tcapi.viewer.setSelection({
      modelObjectIds: [
        {
          modelId: modelId,
          objectRuntimeIds: [asm],
        },
      ],
    });
    await tcapi.viewer.isolateEntities([
      {
        modelId: modelId,
        entityIds: [asm],
      },
    ]);
    await tcapi.viewer.setCamera({
      modelObjectIds: [
        {
          modelId: modelId,
          objectRuntimeIds: [asm],
        },
      ],
    });
  }

  React.useEffect(() => {}, []);
  return (
    <Layout style={{ height: "100vh" }}>
      <Header style={{ background: "#fff", height: "auto" }}>
        <Title level={4} style={{ margin: 0, alignContent: "center" }}>
          Test
        </Title>
      </Header>
      <Content>
        <List
          dataSource={items}
          renderItem={(item, index) => (
            <SortableItem key={item} id={item}>
              <List.Item>
                <MenuOutlined style={{ marginRight: 12 }} />
                <strong>{index + 1}.</strong>&nbsp;{item}
              </List.Item>
            </SortableItem>
          )}
        />
        {/* <Card style={{ background: "#67bed9" }}>
          <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext
              items={items}
              strategy={verticalListSortingStrategy}
            >
              <List
                dataSource={items}
                renderItem={(item, index) => (
                  <SortableItem key={item} id={item}>
                    <List.Item>
                      <MenuOutlined style={{ marginRight: 12 }} />
                      <strong>{index + 1}.</strong>&nbsp;{item}
                    </List.Item>
                  </SortableItem>
                )}
              />
            </SortableContext>
          </DndContext>
        </Card> */}
      </Content>
    </Layout>
  );
}

export default App;
