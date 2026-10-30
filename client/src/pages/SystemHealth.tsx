import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { openOperatorLoginModal } from "@/const";
import { toast } from "sonner";
import {
  OverallSummaryCard,
  DatabaseHealthCard,
  ModelHealthCard,
  LiveApplicationConsole,
  type ModelHealthInfo,
  type ModelSelfTestResult,
  type SystemHealthSummary,
} from "@/features/systemHealth";

export default function SystemHealthPage() {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = user?.role === "admin";

  const [autoRefresh, setAutoRefresh] = useState(true);
  const [checkingModelId, setCheckingModelId] = useState<string | null>(null);
  const [testingModelId, setTestingModelId] = useState<string | null>(null);
  const [selfTestResults, setSelfTestResults] = useState<Record<string, ModelSelfTestResult>>({});
  const [individualModelOverrides, setIndividualModelOverrides] = useState<Record<string, ModelHealthInfo>>({});

  // Telemetry queries
  const overviewQuery = trpc.systemHealth.overview.useQuery(undefined, {
    refetchInterval: autoRefresh ? 10_000 : false,
  });

  const logsQuery = trpc.systemHealth.logs.useQuery(
    { limit: 500 },
    {
      refetchInterval: autoRefresh ? 4_000 : false,
    }
  );

  // Mutations
  const checkModelMutation = trpc.systemHealth.checkModel.useMutation({
    onSuccess: (data) => {
      setIndividualModelOverrides((prev) => ({
        ...prev,
        [data.modelId]: data,
      }));
      toast.success(`${data.shortName} status checked`, {
        description: `State: ${data.state.toUpperCase()} (${data.healthCheckLatencyMs}ms)`,
      });
      setCheckingModelId(null);
    },
    onError: (err) => {
      toast.error("Health check failed", {
        description: err.message,
      });
      setCheckingModelId(null);
    },
  });

  const selfTestMutation = trpc.systemHealth.selfTest.useMutation({
    onSuccess: (data) => {
      setSelfTestResults((prev) => ({
        ...prev,
        [data.modelId]: data,
      }));
      toast.success(`${data.modelName} self-test passed`, {
        description: data.summary,
      });
      setTestingModelId(null);
      // Trigger logs refresh to display self-test execution log
      logsQuery.refetch();
    },
    onError: (err) => {
      toast.error("Self-test error", {
        description: err.message,
      });
      setTestingModelId(null);
    },
  });

  const clearLogsMutation = trpc.systemHealth.clearLogs.useMutation({
    onSuccess: () => {
      toast.success("Server log buffer flushed");
      logsQuery.refetch();
    },
    onError: (err) => {
      toast.error("Failed to clear server logs", {
        description: err.message,
      });
    },
  });

  // Action handlers
  const handleRefreshAll = () => {
    overviewQuery.refetch();
    logsQuery.refetch();
    toast.info("Refreshed all system health telemetry");
  };

  const handleCheckModel = (modelId: "model1" | "model2" | "model3" | "model4") => {
    setCheckingModelId(modelId);
    checkModelMutation.mutate({ modelId });
  };

  const handleRunSelfTest = (modelId: "model1" | "model2" | "model3" | "model4") => {
    if (!isAuthenticated) {
      toast.error("Operator or Admin authentication required", {
        description: "Please sign in to execute model self-tests.",
      });
      openOperatorLoginModal();
      return;
    }

    setTestingModelId(modelId);
    selfTestMutation.mutate({ modelId });
  };

  const handleClearServerLogs = () => {
    if (!isAdmin) {
      toast.error("Admin role required to clear server logs");
      return;
    }
    clearLogsMutation.mutate();
  };

  // Merge overview models with any individual check overrides
  const summary: SystemHealthSummary | null = overviewQuery.data || null;

  const getModelData = (key: "model1" | "model2" | "model3" | "model4"): ModelHealthInfo | null => {
    if (individualModelOverrides[key]) {
      return individualModelOverrides[key];
    }
    return summary?.models[key] || null;
  };

  const m1 = getModelData("model1");
  const m2 = getModelData("model2");
  const m3 = getModelData("model3");
  const m4 = getModelData("model4");

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Overall System Health Summary Banner */}
      <OverallSummaryCard
        summary={summary}
        isLoading={overviewQuery.isFetching}
        onRefreshAll={handleRefreshAll}
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={() => setAutoRefresh(!autoRefresh)}
        autoRefreshIntervalSec={10}
      />

      {/* 2. Database Connectivity Monitoring */}
      {summary?.databases && (
        <DatabaseHealthCard databases={summary.databases} />
      )}

      {/* 3. Model 1-4 Readiness & Health Cards */}
      <div>
        <div className="mb-3 px-1">
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Multi-Model Inference Readiness & Artifact Integrity
          </h2>
          <p className="text-xs text-slate-500">
            Real-time status of all four AI models, trained artifact checkpoints, backend bridges, and operational governance constraints
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {m1 && (
            <ModelHealthCard
              model={m1}
              isChecking={checkingModelId === "model1"}
              isSelfTesting={testingModelId === "model1"}
              selfTestResult={selfTestResults["model1"]}
              onCheckHealth={() => handleCheckModel("model1")}
              onRunSelfTest={() => handleRunSelfTest("model1")}
            />
          )}

          {m2 && (
            <ModelHealthCard
              model={m2}
              isChecking={checkingModelId === "model2"}
              isSelfTesting={testingModelId === "model2"}
              selfTestResult={selfTestResults["model2"]}
              onCheckHealth={() => handleCheckModel("model2")}
              onRunSelfTest={() => handleRunSelfTest("model2")}
            />
          )}

          {m3 && (
            <ModelHealthCard
              model={m3}
              isChecking={checkingModelId === "model3"}
              isSelfTesting={testingModelId === "model3"}
              selfTestResult={selfTestResults["model3"]}
              onCheckHealth={() => handleCheckModel("model3")}
              onRunSelfTest={() => handleRunSelfTest("model3")}
            />
          )}

          {m4 && (
            <ModelHealthCard
              model={m4}
              isChecking={checkingModelId === "model4"}
              isSelfTesting={testingModelId === "model4"}
              selfTestResult={selfTestResults["model4"]}
              onCheckHealth={() => handleCheckModel("model4")}
              onRunSelfTest={() => handleRunSelfTest("model4")}
            />
          )}
        </div>
      </div>

      {/* 4. Live Application Diagnostic Console */}
      <div>
        <div className="mb-3 px-1">
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Diagnostic Telemetry & Live Event Log
          </h2>
          <p className="text-xs text-slate-500">
            Real-time structured event stream from Node backend, FastAPI bridges, Model inference pipelines, and SQLite persistence
          </p>
        </div>

        <LiveApplicationConsole
          logs={((logsQuery.data as any)?.entries) || []}
          totalBuffered={((logsQuery.data as any)?.totalBuffered) || 0}
          isLoading={logsQuery.isFetching}
          onRefreshLogs={() => logsQuery.refetch()}
          onClearServerLogs={handleClearServerLogs}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
}
