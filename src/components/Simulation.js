import { Button, DatePicker, Select, Slider, Space } from "antd";

import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

import {
  StepBackwardOutlined,
  StepForwardOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
} from "@ant-design/icons";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import * as WorkspaceAPI from "trimble-connect-workspace-api";

import {
  SetActiveSimulationItem,
  SetSimulationDateRange,
} from "../store/sequence/action";
import { Await } from "react-router-dom";

dayjs.extend(customParseFormat);

const DATE_FORMATS = ["DD-MM-YYYY", "DD/MM/YYYY", "YYYY-MM-DD", "YYYY/MM/DD"];

export default function Simulation() {
  const dispatch = useDispatch();

  const plans = useSelector((state) => state.sequence.plans || []);

  const sequenceObjects = useSelector(
    (state) => state.sequence.sequenceObjects || [],
  );

  const subPlans = useSelector((state) => state.sequence.subPlans || []);

  const tcapiRef = useRef(null);
  const intervalRef = useRef(null);

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const [delay, setDelay] = useState(200);

  const [selectedPlanIds, setSelectedPlanIds] = useState([]);

  const [startDate, setStartDate] = useState(null);

  const [endDate, setEndDate] = useState(null);

  // =====================================================
  // DATE PARSER
  // =====================================================

  const parseDate = useCallback((value) => {
    if (!value) return null;

    if (dayjs.isDayjs(value)) {
      return value.isValid() ? value : null;
    }

    const strictDate = dayjs(value, DATE_FORMATS, true);

    if (strictDate.isValid()) {
      return strictDate;
    }

    const normalDate = dayjs(value);

    return normalDate.isValid() ? normalDate : null;
  }, []);

  // =====================================================
  // DEFAULT SELECT ALL PLANS
  // =====================================================

  useEffect(() => {
    const validPlanIds = plans.map((plan) => String(plan.id));

    setSelectedPlanIds((current) => {
      /*
       * Firt load:
       * Select All Plans.
       */
      if (!current.length) {
        return validPlanIds;
      }

      /*
       * Remove deleted plan.
       */
      const existingSelectedIds = current.filter((id) =>
        validPlanIds.includes(String(id)),
      );

      /*
       Reselect all plan
       */
      if (!existingSelectedIds.length) {
        return validPlanIds;
      }

      return existingSelectedIds;
    });
  }, [plans]);

  // =====================================================
  // BUILD ALL SIMULATION ITEMS
  // =====================================================

  const allItems = useMemo(() => {
    if (!sequenceObjects.length) {
      return [];
    }

    const result = [];
    let originalIndex = 0;

    sequenceObjects.forEach((group, groupIndex) => {
      if (!group) return;

      const groupPlanId = String(group.planId || "");

      const plan = plans.find((item) => String(item.id) === groupPlanId);

      const objects = group.objects || [];

      objects.forEach((obj, objectIndex) => {
        const runtimeId = obj.id || obj.runtimeId || obj.objectRuntimeId;

        const planId = String(group.planId || obj.planId || "");

        const subPlanId = String(group.subPlanId || obj.subPlanId || "");

        const simulationDate = obj.assignedDate || obj.date;

        const parsedDate = parseDate(simulationDate);

        /*
         Remove invalid object from plan
         */
        if (!parsedDate) {
          return;
        }

        result.push({
          ...obj,

          planId,
          subPlanId,

          groupIndex,
          objectIndex,

          originalIndex: originalIndex++,

          planName: plan?.name || group.planName || `Plan ${groupIndex + 1}`,

          name:
            obj.asmPos ||
            obj.name ||
            obj.objectName ||
            `Object ${objectIndex + 1}`,

          modelId: obj.modelId || group.modelId,

          runtimeId,

          id: String(runtimeId),

          simulationDate: parsedDate.format("DD-MM-YYYY"),

          simulationTime: parsedDate.valueOf(),
        });
      });
    });

    return result.sort((a, b) => {
      if (a.simulationTime !== b.simulationTime) {
        return a.simulationTime - b.simulationTime;
      }

      return a.originalIndex - b.originalIndex;
    });
  }, [sequenceObjects, plans, parseDate]);

  // =====================================================
  // FILTER BY PLAN + START DATE + END DATE
  // =====================================================

  const items = useMemo(() => {
    const selectedPlanSet = new Set(selectedPlanIds.map((id) => String(id)));

    const start = startDate ? dayjs(startDate).startOf("day") : null;

    const end = endDate ? dayjs(endDate).endOf("day") : null;

    const filtered = allItems.filter((item) => {
      if (!selectedPlanSet.has(String(item.planId))) {
        return false;
      }

      const itemDate = parseDate(item.simulationDate);

      if (!itemDate) {
        return false;
      }

      if (start && itemDate.isBefore(start, "day")) {
        return false;
      }

      if (end && itemDate.isAfter(end, "day")) {
        return false;
      }

      return true;
    });

    return filtered.map((item, i) => ({
      ...item,

      value:
        filtered.length === 1
          ? 0
          : Math.round((i / (filtered.length - 1)) * 100),
    }));
  }, [allItems, selectedPlanIds, startDate, endDate, parseDate]);

  const current = items[index];

  // =====================================================
  // RESET SIMULATION WHEN FILTER CHANGES
  // =====================================================

  useEffect(() => {
    setPlaying(false);
    setIndex(0);

    clearInterval(intervalRef.current);
  }, [selectedPlanIds, startDate, endDate]);

  useEffect(() => {
    if (!items.length) {
      setIndex(0);
      setPlaying(false);
      return;
    }

    if (index >= items.length) {
      setIndex(0);
    }
  }, [items.length, index]);

  // =====================================================
  // SAVE DATE RANGE TO REDUX
  // =====================================================

  useEffect(() => {
    dispatch(
      SetSimulationDateRange({
        startDate: startDate ? startDate.format("DD-MM-YYYY") : null,

        endDate: endDate ? endDate.format("DD-MM-YYYY") : null,
      }),
    );
  }, [startDate, endDate, dispatch]);

  // =====================================================
  // TRIMBLE CONNECT API
  // =====================================================

  const getTcapi = async () => {
    if (!tcapiRef.current) {
      tcapiRef.current = await WorkspaceAPI.connect(window.parent);
    }

    return tcapiRef.current;
  };

  const buildAccumulatedObjects = useCallback(
    (toIndex) => {
      const modelMap = new Map();

      items.slice(0, toIndex + 1).forEach((item) => {
        if (!item.modelId || item.runtimeId == null) {
          return;
        }

        const modelId = String(item.modelId);

        if (!modelMap.has(modelId)) {
          modelMap.set(modelId, {
            modelId: item.modelId,

            entityIds: [],
          });
        }

        modelMap.get(modelId).entityIds.push(item.runtimeId);
      });

      return Array.from(modelMap.values());
    },
    [items],
  );

  const selectObjectInTrimble = async (item) => {
    if (!item?.modelId || item?.runtimeId == null) {
      return;
    }

    const tcapi = await getTcapi();

    await tcapi.viewer.setSelection(
      {
        modelObjectIds: [
          {
            modelId: item.modelId,

            objectRuntimeIds: [item.runtimeId],
          },
        ],
      },
      "set",
    );
  };

  const colorObjectInTrimble = async (item) => {
    if (!item?.modelId || item?.runtimeId == null) {
      return;
    }

    const subPlan = subPlans.find(
      (subPlanItem) => String(subPlanItem.id) === String(item.subPlanId),
    );

    if (!subPlan?.color) {
      return;
    }

    const tcapi = await getTcapi();

    await tcapi.viewer.setObjectState(
      {
        modelObjectIds: [
          {
            modelId: item.modelId,

            objectRuntimeIds: [item.runtimeId],
          },
        ],
      },
      {
        color: {
          r: subPlan.color.r,
          g: subPlan.color.g,
          b: subPlan.color.b,
        },

        visible: true,
      },
    );
  };

  const gotoCamera = async (item, objects) => {
    try {
      const tcapi = await getTcapi();

      if (item?.camera) {
        await tcapi.viewer.setCamera(item.camera, {
          animationTime: 1000,
        });
        return;
      }

      if (!objects?.length) {
        return;
      }

      const selector = {
        modelObjectIds: objects
          .filter(
            (group) =>
              group.modelId != null &&
              Array.isArray(group.entityIds) &&
              group.entityIds.length > 0,
          )
          .map((group) => ({
            modelId: group.modelId,
            objectRuntimeIds: group.entityIds,
          })),
      };

      if (!selector.modelObjectIds.length) {
        return;
      }

      await tcapi.viewer.setCamera(selector, {
        animationTime: 1000,
      });
    } catch (error) {
      console.error("gotoCamera error:", error);
    }
  };

  const isolateObjectsInTrimble = async (objects) => {
    if (!objects?.length) {
      return;
    }

    const tcapi = await getTcapi();

    const isolateObjects = objects.map((group) => ({
      modelId: group.modelId,
      entityIds: [...(group.entityIds || [])],
    }));

    const modelMap = new Map(
      isolateObjects.map((group) => [String(group.modelId), group]),
    );

    const grids = await tcapi.viewer.getObjects({
      parameter: {
        class: "IFCGRID",
      },
    });

    grids.forEach((group) => {
      const key = String(group.modelId);

      const gridIds = (group.objects || [])
        .map((item) => item.id)
        .filter((id) => id != null);

      if (modelMap.has(key)) {
        const target = modelMap.get(key);

        target.entityIds = [...new Set([...target.entityIds, ...gridIds])];
      } else {
        const target = {
          modelId: group.modelId,
          entityIds: [...new Set(gridIds)],
        };

        isolateObjects.push(target);
        modelMap.set(key, target);
      }
    });

    await tcapi.viewer.isolateEntities(isolateObjects);
  };
  // =====================================================
  // NAVIGATION
  // =====================================================

  const goToIndex = useCallback(
    async (newIndex) => {
      if (!items.length) return;

      const safeIndex = Math.max(0, Math.min(newIndex, items.length - 1));

      const item = items[safeIndex];

      if (!item) return;

      setIndex(safeIndex);

      dispatch(
        SetActiveSimulationItem({
          planId: String(item.planId),

          subPlanId: String(item.subPlanId),

          modelId: item.modelId,

          id: String(item.id),

          runtimeId: item.runtimeId,
        }),
      );

      try {
        const accumulatedObjects = buildAccumulatedObjects(safeIndex);

        await isolateObjectsInTrimble(accumulatedObjects);

        await gotoCamera(item, accumulatedObjects);

        await colorObjectInTrimble(item);

        await selectObjectInTrimble(item);
      } catch (error) {
        console.error("Simulation viewer error:", error);
      }
    },
    [items, dispatch, buildAccumulatedObjects, subPlans],
  );

  const next = () => {
    setPlaying(false);

    goToIndex(index + 1);
  };

  const prev = () => {
    setPlaying(false);

    goToIndex(index - 1);
  };

  const togglePlay = async () => {
    if (!items.length) {
      return;
    }

    if (!playing) {
      if (index >= items.length - 1) {
        await goToIndex(0);
      } else {
        await goToIndex(index);
      }
    }

    setPlaying((currentPlaying) => !currentPlaying);
  };

  // =====================================================
  // AUTO PLAY
  // =====================================================

  useEffect(() => {
    if (!playing || !items.length) {
      clearInterval(intervalRef.current);

      return;
    }

    intervalRef.current = setInterval(() => {
      const nextIndex = index + 1;

      if (nextIndex >= items.length) {
        clearInterval(intervalRef.current);

        setPlaying(false);
        return;
      }

      goToIndex(nextIndex);
    }, delay);

    return () => {
      clearInterval(intervalRef.current);
    };
  }, [playing, delay, index, items.length, goToIndex]);

  useEffect(() => {
    return () => {
      clearInterval(intervalRef.current);
    };
  }, []);

  // =====================================================
  // SLIDER MARKS
  // =====================================================

  const marks = useMemo(() => {
    return items.reduce((result, item, itemIndex) => {
      result[item.value] = {
        label: (
          <div
            onClick={() => {
              setPlaying(false);

              goToIndex(itemIndex);
            }}
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              cursor: "pointer",
            }}
          />
        ),
      };

      return result;
    }, {});
  }, [items, goToIndex]);

  // =====================================================
  // FILTER HANDLERS
  // =====================================================

  const handlePlanChange = (values) => {
    setPlaying(false);
    setIndex(0);

    setSelectedPlanIds(values || []);
  };

  const handleStartDateChange = (date) => {
    setPlaying(false);
    setIndex(0);

    setStartDate(date);

    /*
     * If Start Date > End Date,
     * Delete End Date.
     */
    if (date && endDate && date.isAfter(endDate, "day")) {
      setEndDate(null);
    }
  };

  const handleEndDateChange = (date) => {
    setPlaying(false);
    setIndex(0);

    setEndDate(date);

    /*
     * If End Date < Start Date,
     * Delete Start Date.
     */
    if (date && startDate && date.isBefore(startDate, "day")) {
      setStartDate(null);
    }
  };

  // =====================================================
  // EMPTY DATA
  // =====================================================

  if (!allItems.length) {
    return <div>There is no simulation data available</div>;
  }

  // =====================================================
  // JSX
  // =====================================================

  return (
    <div style={{ width: "100%" }}>
      {/* FILTERS */}
      <div
        style={{
          width: "100%",
          marginBottom: 24,
        }}
      >
        {/* PLAN */}
        <div
          style={{
            width: "100%",
            marginBottom: 8,
          }}
        >
          <Select
            mode="multiple"
            size="small"
            allowClear
            showSearch
            maxTagCount="responsive"
            value={selectedPlanIds}
            placeholder="Select plans"
            optionFilterProp="label"
            onChange={handlePlanChange}
            style={{ width: "100%" }}
            options={plans.map((plan) => ({
              value: String(plan.id),
              label: plan.name || "Unnamed Plan",
            }))}
          />
        </div>

        {/* DATE FILTERS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 8,
            width: "100%",
          }}
        >
          <DatePicker
            size="small"
            style={{ width: "100%" }}
            format="DD-MM-YYYY"
            placeholder="Start Date"
            value={startDate}
            onChange={handleStartDateChange}
            disabledDate={(date) => {
              if (!endDate) {
                return false;
              }

              return date.isAfter(endDate, "day");
            }}
          />

          <DatePicker
            size="small"
            style={{ width: "100%" }}
            format="DD-MM-YYYY"
            placeholder="End Date"
            value={endDate}
            onChange={handleEndDateChange}
            disabledDate={(date) => {
              if (!startDate) {
                return false;
              }

              return date.isBefore(startDate, "day");
            }}
          />
        </div>
      </div>

      {!selectedPlanIds.length ? (
        <div>Please select at least one plan</div>
      ) : !items.length ? (
        <div>No objects match the selected plans and date range</div>
      ) : (
        <>
          {/* CURRENT ITEM */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              marginBottom: 8,
              fontWeight: 600,
              fontSize: 16,
            }}
          >
            <span>{current?.planName || "-"}</span>

            <span>
              {`${current?.asmPos ?? ""} Grid: ${current?.positionCode ?? ""}`}
            </span>

            <span>
              {`${Number(Number(current?.weight || 0).toFixed(2))}kg`}
            </span>

            <span>{current?.simulationDate || "-"}</span>
          </div>

          {/* SIMULATION SLIDER */}
          <Slider
            style={{ width: "100%" }}
            min={0}
            max={100}
            value={current?.value ?? 0}
            marks={marks}
            tooltip={{ open: false }}
            onChange={(value) => {
              const nearestIndex = items.reduce(
                (bestIndex, item, itemIndex) => {
                  const currentDistance = Math.abs(item.value - value);

                  const bestDistance = Math.abs(items[bestIndex].value - value);

                  return currentDistance < bestDistance ? itemIndex : bestIndex;
                },
                0,
              );

              setPlaying(false);

              goToIndex(nearestIndex);
            }}
          />

          {/* CONTROLS */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: 16,
            }}
          >
            <Space>
              <Button
                icon={<StepBackwardOutlined />}
                onClick={prev}
                disabled={index === 0}
              />

              <Button
                type="primary"
                shape="circle"
                icon={
                  playing ? <PauseCircleOutlined /> : <PlayCircleOutlined />
                }
                onClick={togglePlay}
              />

              <Button
                icon={<StepForwardOutlined />}
                onClick={next}
                disabled={index === items.length - 1}
              />
            </Space>
          </div>

          {/* SPEED */}
          <div style={{ marginTop: 12 }}>
            <span>Timing: {delay} ms</span>

            <Slider
              min={50}
              max={5000}
              step={50}
              value={delay}
              onChange={setDelay}
              tooltip={{
                formatter: (value) => `${value} ms`,
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
