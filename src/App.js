import { Layout, Menu } from "antd";
import { DashboardOutlined, UserOutlined } from "@ant-design/icons";
import TopMenu from "./components/TopMenu";
import { GetPlanRequest } from "./store/sequence/action";
import * as WorkspaceAPI from "trimble-connect-workspace-api";
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Main from "./components/Main";

const { Header, Sider, Content, Footer } = Layout;

export default function App() {
  const dispatch = useDispatch();
  const [projectId, setProjectId] = useState("");
  const [projectName, setProjectName] = useState("");
  useEffect(() => {
    async function fetchStatus() {
      const tcapi = await WorkspaceAPI.connect(window.parent);
      const token = await tcapi.extension.requestPermission("accesstoken");
      window.localStorage.setItem("trimbleToken", token);
      const project = await tcapi.project.getProject();
      setProjectId(project.id);
      setProjectName(project.name);
      dispatch(
        GetPlanRequest({
          projectId: project.id,
          projectName: project.name,
        }),
      );
    }
    fetchStatus();
  }, []);
  return (
    <Layout style={{ minHeight: "100vh" }}>
      <TopMenu />
      <Content style={{ margin: 5 }}>
        <Main />
      </Content>
      <Footer>Footer</Footer>
    </Layout>
  );
}
