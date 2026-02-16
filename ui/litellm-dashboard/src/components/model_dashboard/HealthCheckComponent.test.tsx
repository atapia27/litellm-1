/* @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import HealthCheckComponent from "./HealthCheckComponent";

const mockIndividualModelHealthCheckCall = vi.fn();
const mockLatestHealthChecksCall = vi.fn();

vi.mock("../networking", () => ({
  individualModelHealthCheckCall: (...args: unknown[]) => mockIndividualModelHealthCheckCall(...args),
  latestHealthChecksCall: (...args: unknown[]) => mockLatestHealthChecksCall(...args),
}));

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = createQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("HealthCheckComponent", () => {
  const getDisplayModelName = (model: { model_name?: string }) => model.model_name ?? "";

  beforeEach(() => {
    vi.clearAllMocks();
    mockLatestHealthChecksCall.mockResolvedValue({ latest_health_checks: {} });
    mockIndividualModelHealthCheckCall.mockResolvedValue({
      healthy_count: 1,
      unhealthy_count: 0,
      healthy_endpoints: [],
      unhealthy_endpoints: [],
    });
  });

  it("should render the health check section", async () => {
    const modelData = {
      data: [
        {
          model_name: "gpt-4",
          model_info: { id: "deployment-1" },
          litellm_model_name: "gpt-4",
        },
      ],
    };

    await act(async () => {
      renderWithQueryClient(
        <HealthCheckComponent
          accessToken="token"
          modelData={modelData}
          all_models_on_proxy={["deployment-1"]}
          getDisplayModelName={getDisplayModelName}
        />,
      );
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(screen.getByText("Model Health Status")).toBeInTheDocument();
    expect(
      screen.getByText("Run health checks on individual models to verify they are working correctly"),
    ).toBeInTheDocument();
  });

  it("should call individualModelHealthCheckCall with model id when run health check is triggered", async () => {
    const modelData = {
      data: [
        {
          model_name: "gpt-4",
          model_info: { id: "deployment-abc-123" },
          litellm_model_name: "gpt-4",
        },
      ],
    };

    renderWithQueryClient(
      <HealthCheckComponent
        accessToken="token-123"
        modelData={modelData}
        all_models_on_proxy={["deployment-abc-123"]}
        getDisplayModelName={getDisplayModelName}
      />,
    );

    await waitFor(() => {
      expect(mockLatestHealthChecksCall).toHaveBeenCalledWith("token-123");
    });

    const runButtons = screen.getAllByTestId("run-health-check-btn");
    expect(runButtons.length).toBeGreaterThanOrEqual(1);
    const runButton = runButtons[0];

    await act(async () => {
      runButton.click();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockIndividualModelHealthCheckCall).toHaveBeenCalledWith("token-123", "deployment-abc-123");
    expect(mockIndividualModelHealthCheckCall).not.toHaveBeenCalledWith("token-123", "gpt-4");
  });

  describe("latest_health_checks keyed by model id", () => {
    it("should show status from latest_health_checks when keys match model ids", async () => {
      const modelData = {
        data: [
          {
            model_name: "gpt-4",
            model_info: { id: "id-alpha" },
            litellm_model_name: "gpt-4",
          },
          {
            model_name: "gpt-4",
            model_info: { id: "id-beta" },
            litellm_model_name: "gpt-4",
          },
        ],
      };

      mockLatestHealthChecksCall.mockResolvedValue({
        latest_health_checks: {
          "id-alpha": {
            status: "healthy",
            checked_at: "2024-01-15T10:00:00Z",
            error_message: null,
          },
          "id-beta": {
            status: "unhealthy",
            checked_at: "2024-01-15T10:05:00Z",
            error_message: "Connection failed",
          },
        },
      });

      await act(async () => {
        renderWithQueryClient(
          <HealthCheckComponent
            accessToken="token"
            modelData={modelData}
            all_models_on_proxy={["id-alpha", "id-beta"]}
            getDisplayModelName={getDisplayModelName}
          />,
        );
      });

      await waitFor(() => {
        expect(mockLatestHealthChecksCall).toHaveBeenCalledWith("token");
      });
      await waitFor(() => {
        const healthyBadges = screen.getAllByText("healthy");
        const unhealthyBadges = screen.getAllByText("unhealthy");
        expect(healthyBadges.length).toBeGreaterThanOrEqual(1);
        expect(unhealthyBadges.length).toBeGreaterThanOrEqual(1);
      });
    });

    it("should skip latest_health_checks entries whose key is not a known model id", async () => {
      const modelData = {
        data: [
          {
            model_name: "gpt-4",
            model_info: { id: "current-model-id" },
            litellm_model_name: "gpt-4",
          },
        ],
      };

      mockLatestHealthChecksCall.mockResolvedValue({
        latest_health_checks: {
          "current-model-id": {
            status: "healthy",
            checked_at: "2024-01-15T10:00:00Z",
            error_message: null,
          },
          "deleted-or-unknown-id": {
            status: "unhealthy",
            checked_at: "2024-01-15T10:05:00Z",
            error_message: "Stale entry",
          },
        },
      });

      await act(async () => {
        renderWithQueryClient(
          <HealthCheckComponent
            accessToken="token"
            modelData={modelData}
            all_models_on_proxy={["current-model-id"]}
            getDisplayModelName={getDisplayModelName}
          />,
        );
      });

      await waitFor(() => {
        expect(mockLatestHealthChecksCall).toHaveBeenCalledWith("token");
      });
      await waitFor(() => {
        expect(screen.getByText("healthy")).toBeInTheDocument();
      });
      expect(screen.queryByText("unhealthy")).not.toBeInTheDocument();
    });

    it("should not apply status when latest_health_checks key is model name not model id", async () => {
      const modelData = {
        data: [
          {
            model_name: "gpt-4",
            model_info: { id: "model-id-123" },
            litellm_model_name: "gpt-4",
          },
        ],
      };

      mockLatestHealthChecksCall.mockResolvedValue({
        latest_health_checks: {
          "gpt-4": {
            status: "healthy",
            checked_at: "2024-01-15T10:00:00Z",
            error_message: null,
          },
        },
      });

      await act(async () => {
        renderWithQueryClient(
          <HealthCheckComponent
            accessToken="token"
            modelData={modelData}
            all_models_on_proxy={["model-id-123"]}
            getDisplayModelName={getDisplayModelName}
          />,
        );
      });

      await waitFor(() => {
        expect(mockLatestHealthChecksCall).toHaveBeenCalledWith("token");
      });
      await waitFor(() => {
        expect(screen.getByText("none")).toBeInTheDocument();
      });
      expect(screen.queryByText("healthy")).not.toBeInTheDocument();
    });
  });

  describe("Run All / Run Selected with React Query", () => {
    it("should call individualModelHealthCheckCall for each model when Run All Checks is clicked", async () => {
      const modelData = {
        data: [
          { model_name: "gpt-4", model_info: { id: "id-1" }, litellm_model_name: "gpt-4" },
          { model_name: "gpt-4", model_info: { id: "id-2" }, litellm_model_name: "gpt-4" },
        ],
      };

      renderWithQueryClient(
        <HealthCheckComponent
          accessToken="token"
          modelData={modelData}
          all_models_on_proxy={["id-1", "id-2"]}
          getDisplayModelName={getDisplayModelName}
        />,
      );

      await waitFor(() => {
        expect(mockLatestHealthChecksCall).toHaveBeenCalledWith("token");
      });

      const runAllButton = screen.getByRole("button", { name: "Run All Checks" });
      await act(async () => {
        runAllButton.click();
      });

      await waitFor(() => {
        expect(mockIndividualModelHealthCheckCall).toHaveBeenCalledWith("token", "id-1");
        expect(mockIndividualModelHealthCheckCall).toHaveBeenCalledWith("token", "id-2");
        expect(mockIndividualModelHealthCheckCall).toHaveBeenCalledTimes(2);
      });
    });

    it("should call individualModelHealthCheckCall only for selected models when Run Selected Checks is clicked", async () => {
      const modelData = {
        data: [
          { model_name: "gpt-4", model_info: { id: "id-a" }, litellm_model_name: "gpt-4" },
          { model_name: "gpt-4", model_info: { id: "id-b" }, litellm_model_name: "gpt-4" },
          { model_name: "gpt-4", model_info: { id: "id-c" }, litellm_model_name: "gpt-4" },
        ],
      };

      renderWithQueryClient(
        <HealthCheckComponent
          accessToken="token"
          modelData={modelData}
          all_models_on_proxy={["id-a", "id-b", "id-c"]}
          getDisplayModelName={getDisplayModelName}
        />,
      );

      await waitFor(() => {
        expect(mockLatestHealthChecksCall).toHaveBeenCalledWith("token");
      });

      const checkboxes = screen.getAllByRole("checkbox");
      const firstRowCheckbox = checkboxes[1];
      await act(async () => {
        firstRowCheckbox.click();
      });

      const runSelectedButton = screen.getByRole("button", { name: "Run Selected Checks" });
      await act(async () => {
        runSelectedButton.click();
      });

      await waitFor(() => {
        expect(mockIndividualModelHealthCheckCall).toHaveBeenCalledWith("token", "id-a");
      });
      expect(mockIndividualModelHealthCheckCall).toHaveBeenCalledTimes(1);
    });

    it("should show unhealthy badge when per-model check returns unhealthy response", async () => {
      const modelData = {
        data: [
          { model_name: "gpt-4", model_info: { id: "unhealthy-model" }, litellm_model_name: "gpt-4" },
        ],
      };

      mockIndividualModelHealthCheckCall.mockResolvedValue({
        healthy_count: 0,
        unhealthy_count: 1,
        healthy_endpoints: [],
        unhealthy_endpoints: [{ error: "Connection refused" }],
      });

      renderWithQueryClient(
        <HealthCheckComponent
          accessToken="token"
          modelData={modelData}
          all_models_on_proxy={["unhealthy-model"]}
          getDisplayModelName={getDisplayModelName}
        />,
      );

      await waitFor(() => {
        expect(mockLatestHealthChecksCall).toHaveBeenCalledWith("token");
      });

      const runButtons = screen.getAllByTestId("run-health-check-btn");
      await act(async () => {
        runButtons[0].click();
      });

      await waitFor(() => {
        expect(mockIndividualModelHealthCheckCall).toHaveBeenCalledWith("token", "unhealthy-model");
      });
      await waitFor(() => {
        expect(screen.getByText("unhealthy")).toBeInTheDocument();
      });
    });

    it("should show unhealthy state when per-model check throws", async () => {
      const modelData = {
        data: [
          { model_name: "gpt-4", model_info: { id: "error-model" }, litellm_model_name: "gpt-4" },
        ],
      };

      mockIndividualModelHealthCheckCall.mockRejectedValue(new Error("Network error"));

      renderWithQueryClient(
        <HealthCheckComponent
          accessToken="token"
          modelData={modelData}
          all_models_on_proxy={["error-model"]}
          getDisplayModelName={getDisplayModelName}
        />,
      );

      await waitFor(() => {
        expect(mockLatestHealthChecksCall).toHaveBeenCalledWith("token");
      });

      const runButtons = screen.getAllByTestId("run-health-check-btn");
      await act(async () => {
        runButtons[0].click();
      });

      await waitFor(() => {
        expect(mockIndividualModelHealthCheckCall).toHaveBeenCalledWith("token", "error-model");
      });
      await waitFor(() => {
        expect(screen.getByText("unhealthy")).toBeInTheDocument();
      });
    });

    it("should not fetch latest or run checks when accessToken is null", async () => {
      const modelData = {
        data: [
          { model_name: "gpt-4", model_info: { id: "deployment-1" }, litellm_model_name: "gpt-4" },
        ],
      };

      renderWithQueryClient(
        <HealthCheckComponent
          accessToken={null}
          modelData={modelData}
          all_models_on_proxy={["deployment-1"]}
          getDisplayModelName={getDisplayModelName}
        />,
      );

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(mockLatestHealthChecksCall).not.toHaveBeenCalled();
      expect(mockIndividualModelHealthCheckCall).not.toHaveBeenCalled();

      const runAllButton = screen.getByRole("button", { name: "Run All Checks" });
      await act(async () => {
        runAllButton.click();
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });
      expect(mockIndividualModelHealthCheckCall).not.toHaveBeenCalled();
    });

    it("should render with empty model list without crashing", async () => {
      const modelData = { data: [] };

      await act(async () => {
        renderWithQueryClient(
          <HealthCheckComponent
            accessToken="token"
            modelData={modelData}
            all_models_on_proxy={[]}
            getDisplayModelName={getDisplayModelName}
          />,
        );
      });

      expect(screen.getByText("Model Health Status")).toBeInTheDocument();
      expect(mockLatestHealthChecksCall).toHaveBeenCalledWith("token");
      const runAllButton = screen.getByRole("button", { name: "Run All Checks" });
      await act(async () => {
        runAllButton.click();
      });
      expect(mockIndividualModelHealthCheckCall).not.toHaveBeenCalled();
    });

    it("should invalidate latest health checks after Run All so latest is refetched", async () => {
      const modelData = {
        data: [
          { model_name: "gpt-4", model_info: { id: "only-one" }, litellm_model_name: "gpt-4" },
        ],
      };

      renderWithQueryClient(
        <HealthCheckComponent
          accessToken="token"
          modelData={modelData}
          all_models_on_proxy={["only-one"]}
          getDisplayModelName={getDisplayModelName}
        />,
      );

      await waitFor(() => {
        expect(mockLatestHealthChecksCall).toHaveBeenCalledWith("token");
      });
      const initialCalls = mockLatestHealthChecksCall.mock.calls.length;

      const runAllButton = screen.getByRole("button", { name: "Run All Checks" });
      await act(async () => {
        runAllButton.click();
      });

      await waitFor(() => {
        expect(mockIndividualModelHealthCheckCall).toHaveBeenCalledWith("token", "only-one");
      });
      await waitFor(() => {
        expect(mockLatestHealthChecksCall.mock.calls.length).toBeGreaterThan(initialCalls);
      });
    });
  });
});
