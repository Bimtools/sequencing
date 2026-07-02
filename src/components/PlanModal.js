import React from "react";
import {
  Collapse,
  Button,
  Dropdown,
  Popconfirm,
  Modal,
  Form,
  Input,
} from "antd";

const PlanModal = (title, buttonName, plan, open, onCancel, handleFunc) => {
  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      footer={null}
      styles={{
        header: {
          padding: 0,
          marginBottom: 0,
        },
        body: {
          padding: 0,
        },
      }}
    >
      <Form autoComplete="off">
        <Form.Item
          name="planName"
          style={{ marginBottom: 2 }}
          rules={[
            {
              required: true,
              message: "Please enter plan name",
            },
          ]}
        >
          <Input
            placeholder="Plan Name"
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
          />
        </Form.Item>
        <Form.Item style={{ marginBottom: 0 }}>
          <Button
            type="primary"
            htmlType="submit"
            disabled={!planName}
            onClick={handleFunc}
          >
            {buttonName}
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateSubPlanModal;
