"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Role, useDashboard } from "../layout";
import styles from "./page.module.css";

type CampaignStatus =
  | "заплановано"
  | "запущено"
  | "завершено"
  | "зупинено"
  | "скасовано";

type CampaignChannel = "Google" | "Meta" | "TikTok" | "Instagram" | "Facebook";

type Tone = "info" | "green" | "amber" | "neutral" | "red";
type ModalMode = "create" | "edit";
type NoticeType = "success" | "error";
type CampaignAction = "start" | "finish" | "stop" | "cancel";

type Campaign = {
  campaign_id: number;

  project_id: number;
  project_name: string;
  project_status: string;
  project_start_date: string;
  project_end_date: string | null;

  brief_id: number;
  brief_budget: number;

  client_id: number;
  client_name: string;
  client_company: string;
  client_status: string;

  channel: string;
  launch_date: string;
  stop_date: string | null;
  budget: number;
  campaign_status: string;

  is_final?: boolean;
  is_running?: boolean;
  is_planned?: boolean;
  is_overdue?: boolean;

  can_edit?: boolean;
  can_start?: boolean;
  can_finish?: boolean;
  can_stop?: boolean;
  can_cancel?: boolean;
};

type Project = {
  project_id: number;
  brief_id?: number;
  project_name: string;
  start_date: string;
  end_date: string | null;
  status: string;
  client_id?: number;
  client_name?: string;
  client_company?: string;
  category?: string;
  brief_budget?: number;
  budget?: number;
};

type CampaignForm = {
  project_id: string;
  channel: CampaignChannel | "";
  launch_date: string;
  stop_date: string;
  budget: string;
  campaign_status: CampaignStatus;
};

type ApiCampaignsResponse = {
  ok: boolean;
  data?: Campaign[];
  message?: string;
};

type ApiCampaignResponse = {
  ok: boolean;
  data?: Campaign | null;
  message?: string;
};

type ApiProjectsResponse = {
  ok: boolean;
  data?: Project[];
  message?: string;
};

const allowedRoles: Role[] = ["director", "manager", "ads"];

const channels: CampaignChannel[] = [
  "Google",
  "Meta",
  "TikTok",
  "Instagram",
  "Facebook",
];

const MAX_CAMPAIGN_DURATION_DAYS = 370;
const MAX_CAMPAIGN_PLANNING_DAYS = 730;
const MAX_CAMPAIGN_BUDGET = 10_000_000;

const campaignStatuses: {
  id: CampaignStatus;
  label: string;
  tone: Tone;
  hint: string;
}[] = [
  {
    id: "заплановано",
    label: "Заплановано",
    tone: "info",
    hint: "Кампанія створена, але ще не запущена.",
  },
  {
    id: "запущено",
    label: "Запущено",
    tone: "green",
    hint: "Кампанія активна і може збирати статистику.",
  },
  {
    id: "завершено",
    label: "Завершено",
    tone: "neutral",
    hint: "Кампанія завершена і заблокована від редагування.",
  },
  {
    id: "зупинено",
    label: "Зупинено",
    tone: "amber",
    hint: "Кампанія зупинена і залишається в історії CRM.",
  },
  {
    id: "скасовано",
    label: "Скасовано",
    tone: "red",
    hint: "Кампанія скасована без фізичного видалення.",
  },
];

const allowedTransitions: Record<CampaignStatus, CampaignStatus[]> = {
  заплановано: ["заплановано", "запущено", "скасовано"],
  запущено: ["запущено", "завершено", "зупинено", "скасовано"],
  завершено: ["завершено"],
  зупинено: ["зупинено"],
  скасовано: ["скасовано"],
};

const finalCampaignStatuses: CampaignStatus[] = [
  "завершено",
  "зупинено",
  "скасовано",
];

const finalProjectStatuses = ["завершено", "зупинено", "скасовано"];

const emptyForm: CampaignForm = {
  project_id: "",
  channel: "",
  launch_date: "",
  stop_date: "",
  budget: "",
  campaign_status: "заплановано",
};

const statusTone: Record<string, Tone> = {
  заплановано: "info",
  запущено: "green",
  завершено: "neutral",
  зупинено: "amber",
  скасовано: "red",
};

const toneClass: Record<Tone, string> = {
  info: styles.toneInfo,
  green: styles.toneGreen,
  amber: styles.toneAmber,
  neutral: styles.toneNeutral,
  red: styles.toneRed,
};

const fillClass: Record<string, string> = {
  заплановано: styles.fillNeutral,
  запущено: styles.fillGreen,
  завершено: styles.fillNeutral,
  зупинено: styles.fillAmber,
  скасовано: styles.fillRed,
};

const cx = (...classes: (string | false | undefined)[]) =>
  classes.filter(Boolean).join(" ");

function getTodayISO() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDaysISO(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().split("T")[0];
}

function maxISODate(...dates: (string | null | undefined)[]) {
  const validDates = dates.filter(Boolean) as string[];

  if (validDates.length === 0) {
    return getTodayISO();
  }

  return validDates.sort()[validDates.length - 1];
}

function minISODate(...dates: (string | null | undefined)[]) {
  const validDates = dates.filter(Boolean) as string[];

  if (validDates.length === 0) {
    return getTodayISO();
  }

  return validDates.sort()[0];
}

function normalizeBudgetInput(value: string) {
  const cleaned = value.replace(/[^\d.,]/g, "").replace(",", ".");
  const parts = cleaned.split(".");

  if (parts.length <= 1) {
    return cleaned;
  }

  return `${parts[0]}.${parts.slice(1).join("").slice(0, 2)}`;
}

function parseMoney(value: string) {
  const number = Number(value.replace(",", ".").trim());

  if (!Number.isFinite(number)) {
    return Number.NaN;
  }

  return Math.round(number * 100) / 100;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("uk-UA", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value);
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";

  const normalized = iso.includes("T") ? iso.split("T")[0] : iso;
  const [year, month, day] = normalized.split("-");

  if (!year || !month || !day) {
    return "—";
  }

  return `${day}.${month}.${year}`;
}

function isRealISODate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isCampaignStatus(value: string): value is CampaignStatus {
  return campaignStatuses.some((status) => status.id === value);
}

function isFinalCampaignStatus(value: string) {
  return finalCampaignStatuses.includes(value as CampaignStatus);
}

function isFinalProjectStatus(value: string) {
  return finalProjectStatuses.includes(value);
}

function toUTC(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function clampDate(value: string, min: string, max: string | null) {
  if (value < min) return min;
  if (max && value > max) return max;
  return value;
}

function getLaunchMinDate(project: Project | null, mode: ModalMode) {
  if (!project) return getTodayISO();

  if (mode === "create") {
    return maxISODate(getTodayISO(), project.start_date);
  }

  return project.start_date;
}

function getLaunchMaxDate(project: Project | null) {
  if (!project) {
    return addDaysISO(getTodayISO(), MAX_CAMPAIGN_PLANNING_DAYS);
  }

  const planningBase = maxISODate(getTodayISO(), project.start_date);
  const planningMax = addDaysISO(planningBase, MAX_CAMPAIGN_PLANNING_DAYS);

  return project.end_date ? minISODate(project.end_date, planningMax) : planningMax;
}

function getStopMaxDate(launchDate: string, project: Project | null) {
  const durationMax = addDaysISO(
    launchDate || getTodayISO(),
    MAX_CAMPAIGN_DURATION_DAYS
  );

  return project?.end_date ? minISODate(project.end_date, durationMax) : durationMax;
}

function getSafeActionDate(campaign: Campaign) {
  return clampDate(
    getTodayISO(),
    campaign.project_start_date || campaign.launch_date,
    campaign.project_end_date
  );
}

function periodProgress(campaign: Campaign) {
  if (campaign.campaign_status === "заплановано") return 0;

  if (["завершено", "зупинено", "скасовано"].includes(campaign.campaign_status)) {
    return 100;
  }

  const start = toUTC(campaign.launch_date);
  const fallbackStop = campaign.project_end_date || campaign.stop_date;

  if (!fallbackStop) return 45;

  const end = toUTC(fallbackStop);
  const now = toUTC(getTodayISO());

  if (end <= start) return 100;
  if (now <= start) return 0;
  if (now >= end) return 100;

  return Math.round(((now - start) / (end - start)) * 100);
}

function channelMeta(channel: string): { icon: string; cls: string } {
  const c = channel.toLowerCase();

  if (c.includes("facebook")) return { icon: "groups", cls: styles.chFacebook };
  if (c.includes("instagram")) {
    return { icon: "photo_camera", cls: styles.chInstagram };
  }
  if (c.includes("google")) return { icon: "search", cls: styles.chGoogle };
  if (c.includes("tiktok")) return { icon: "music_note", cls: styles.chTiktok };
  if (c.includes("meta")) return { icon: "hub", cls: styles.chMeta };

  return { icon: "campaign", cls: styles.chDefault };
}

function getStatusMeta(status: string) {
  return (
    campaignStatuses.find((item) => item.id === status) || {
      id: "заплановано",
      label: status || "Невідомо",
      tone: "info" as Tone,
      hint: "Невідомий статус",
    }
  );
}

function getAvailableStatusOptions(campaign: Campaign | null) {
  if (!campaign) {
    return campaignStatuses.filter((item) => item.id === "заплановано");
  }

  const currentStatus = isCampaignStatus(campaign.campaign_status)
    ? campaign.campaign_status
    : "заплановано";

  const allowed = allowedTransitions[currentStatus] || [currentStatus];

  return campaignStatuses.filter((item) => allowed.includes(item.id));
}

function getProjectBudget(project: Project | null, campaigns: Campaign[]) {
  if (!project) return null;

  if (typeof project.brief_budget === "number") return project.brief_budget;
  if (typeof project.budget === "number") return project.budget;

  const campaignWithBudget = campaigns.find(
    (campaign) => campaign.project_id === project.project_id
  );

  return campaignWithBudget?.brief_budget ?? null;
}

function getCampaignBudgetUsed(params: {
  campaigns: Campaign[];
  projectId: number;
  excludeCampaignId?: number | null;
}) {
  return params.campaigns
    .filter((campaign) => {
      if (campaign.project_id !== params.projectId) return false;
      if (campaign.campaign_status === "скасовано") return false;

      if (
        params.excludeCampaignId &&
        campaign.campaign_id === params.excludeCampaignId
      ) {
        return false;
      }

      return true;
    })
    .reduce((sum, campaign) => sum + Number(campaign.budget || 0), 0);
}

function getBudgetInfo(params: {
  form: CampaignForm;
  projects: Project[];
  campaigns: Campaign[];
  editingCampaignId: number | null;
}) {
  const projectId = Number(params.form.project_id);
  const project =
    params.projects.find((item) => item.project_id === projectId) || null;

  const budget = getProjectBudget(project, params.campaigns);

  if (!project || !budget) {
    return null;
  }

  const used = getCampaignBudgetUsed({
    campaigns: params.campaigns,
    projectId,
    excludeCampaignId: params.editingCampaignId,
  });

  const currentBudget = parseMoney(params.form.budget);
  const total = Number.isFinite(currentBudget) ? used + currentBudget : used;
  const remaining = budget - used;

  return {
    projectBudget: budget,
    used,
    remaining,
    total,
    isOverLimit: Number.isFinite(currentBudget) && total > budget,
  };
}

function hasActiveChannelDuplicate(params: {
  campaigns: Campaign[];
  projectId: number;
  channel: string;
  editingCampaignId: number | null;
  nextStatus: string;
}) {
  if (isFinalCampaignStatus(params.nextStatus)) {
    return null;
  }

  return (
    params.campaigns.find((campaign) => {
      if (campaign.project_id !== params.projectId) return false;
      if (campaign.channel !== params.channel) return false;
      if (campaign.campaign_id === params.editingCampaignId) return false;

      return !["завершено", "зупинено", "скасовано"].includes(
        campaign.campaign_status
      );
    }) || null
  );
}

function getCampaignCapabilities(campaign: Campaign) {
  const final =
    Boolean(campaign.is_final) || isFinalCampaignStatus(campaign.campaign_status);
  const projectFinal = isFinalProjectStatus(campaign.project_status);
  const today = getTodayISO();

  return {
    isFinal: final,
    canEdit:
      campaign.can_edit !== undefined
        ? campaign.can_edit
        : !final && !projectFinal,

    canStart:
      campaign.campaign_status === "заплановано" &&
      !projectFinal &&
      campaign.launch_date <= today,

    canStartLater:
      campaign.campaign_status === "заплановано" &&
      !projectFinal &&
      campaign.launch_date > today,

    canFinish:
      campaign.can_finish !== undefined
        ? campaign.can_finish
        : campaign.campaign_status === "запущено" && !projectFinal,

    canStop:
      campaign.can_stop !== undefined
        ? campaign.can_stop
        : campaign.campaign_status === "запущено" && !projectFinal,

    canCancel:
      campaign.can_cancel !== undefined
        ? campaign.can_cancel
        : ["заплановано", "запущено"].includes(campaign.campaign_status) &&
          !projectFinal,
  };
}

function validateCampaignForm(params: {
  form: CampaignForm;
  mode: ModalMode;
  selectedProject: Project | null;
  campaigns: Campaign[];
  editingCampaign: Campaign | null;
  editingCampaignId: number | null;
}) {
  const {
    form,
    mode,
    selectedProject,
    campaigns,
    editingCampaign,
    editingCampaignId,
  } = params;

  const projectId = Number(form.project_id);
  const budget = parseMoney(form.budget);
  const launchDate = form.launch_date.trim();
  const stopDate = form.stop_date.trim() || null;
  const status = form.campaign_status;

  if (!Number.isInteger(projectId) || projectId <= 0 || !selectedProject) {
    return "Оберіть коректний проєкт для кампанії.";
  }

  if (!form.channel) {
    return "Оберіть рекламний канал.";
  }

  if (!channels.includes(form.channel)) {
    return "Канал кампанії може бути тільки: Google, Meta, TikTok, Instagram або Facebook.";
  }

  if (!Number.isFinite(budget) || budget <= 0) {
    return "Бюджет кампанії має бути більшим за 0.";
  }

  if (budget > MAX_CAMPAIGN_BUDGET) {
    return "Бюджет кампанії виглядає нереалістично великим.";
  }

  if (isFinalProjectStatus(selectedProject.status)) {
    return "Не можна створювати або редагувати кампанії для фінального проєкту.";
  }

  if (!isRealISODate(launchDate)) {
    return "Вкажіть коректну дату запуску кампанії.";
  }

  if (launchDate < selectedProject.start_date) {
    return "Дата запуску кампанії не може бути раніше дати початку проєкту.";
  }

  if (mode === "create" && launchDate < getTodayISO()) {
    return "Нову кампанію не можна створити з датою запуску в минулому.";
  }

  if (status === "заплановано" && launchDate < getTodayISO()) {
    return "Запланована кампанія не може мати дату запуску в минулому.";
  }

  if (status === "запущено" && launchDate > getTodayISO()) {
    return "Запущена кампанія не може мати дату запуску в майбутньому.";
  }

  const launchMaxDate = getLaunchMaxDate(selectedProject);

  if (launchDate > launchMaxDate) {
    return `Дата запуску кампанії занадто далека. Максимальна дозволена дата: ${formatDate(
      launchMaxDate
    )}.`;
  }

  if (stopDate) {
    if (!isRealISODate(stopDate)) {
      return "Вкажіть коректну дату зупинки кампанії.";
    }

    if (stopDate < launchDate) {
      return "Дата зупинки кампанії не може бути раніше дати запуску.";
    }

    const stopMaxDate = getStopMaxDate(launchDate, selectedProject);

    if (stopDate > stopMaxDate) {
      return `Дата зупинки кампанії занадто далека. Максимальна дозволена дата: ${formatDate(
        stopMaxDate
      )}.`;
    }
  }

  if (!isCampaignStatus(status)) {
    return "Оберіть коректний статус кампанії.";
  }

  if (mode === "create" && status !== "заплановано") {
    return "Нова кампанія створюється тільки зі статусом «заплановано».";
  }

  if (mode === "edit" && editingCampaign) {
    if (isFinalCampaignStatus(editingCampaign.campaign_status)) {
      return "Фінальна кампанія заблокована від редагування.";
    }

    if (isCampaignStatus(editingCampaign.campaign_status)) {
      const allowed = allowedTransitions[editingCampaign.campaign_status];

      if (!allowed.includes(status)) {
        return `Некоректний перехід статусу: «${editingCampaign.campaign_status}» → «${status}».`;
      }
    }
  }

  if (isFinalCampaignStatus(status) && !stopDate) {
    return "Для завершеної, зупиненої або скасованої кампанії потрібно вказати дату зупинки.";
  }

  const duplicate = hasActiveChannelDuplicate({
    campaigns,
    projectId,
    channel: form.channel,
    editingCampaignId,
    nextStatus: status,
  });

  if (duplicate) {
    return `У цьому проєкті вже є активна або запланована кампанія каналу ${form.channel} #${duplicate.campaign_id}.`;
  }

  const budgetInfo = getBudgetInfo({
    form,
    projects: selectedProject ? [selectedProject] : [],
    campaigns,
    editingCampaignId,
  });

  if (budgetInfo?.isOverLimit) {
    return `Сумарний бюджет кампаній буде ${formatMoney(
      budgetInfo.total
    )} грн, але бюджет брифа становить ${formatMoney(
      budgetInfo.projectBudget
    )} грн.`;
  }

  return "";
}

async function readApiJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error(
      "API повернув не JSON. Перевірте, чи існує route.ts і чи запущено npm run dev."
    );
  }

  return (await response.json()) as T;
}

export default function CampaignsPage() {
  const { role } = useDashboard();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editingCampaignId, setEditingCampaignId] = useState<number | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  const [form, setForm] = useState<CampaignForm>({
    ...emptyForm,
    launch_date: getTodayISO(),
  });

  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const [detailsCampaign, setDetailsCampaign] = useState<Campaign | null>(null);

  const [actionCampaign, setActionCampaign] = useState<Campaign | null>(null);
  const [actionType, setActionType] = useState<CampaignAction>("start");
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const [saving, setSaving] = useState(false);
  const [actioning, setActioning] = useState(false);

  const [pageNotice, setPageNotice] = useState<{
    type: NoticeType;
    text: string;
  } | null>(null);

  async function loadCampaigns() {
    const response = await fetch("/api/campaigns", {
      cache: "no-store",
    });

    const result = await readApiJson<ApiCampaignsResponse>(response);

    if (!response.ok || !result.ok || !Array.isArray(result.data)) {
      throw new Error(result.message || "Не вдалося завантажити кампанії.");
    }

    setCampaigns(result.data);
  }

  async function loadProjects() {
    const response = await fetch("/api/projects", {
      cache: "no-store",
    });

    const result = await readApiJson<ApiProjectsResponse>(response);

    if (!response.ok || !result.ok || !Array.isArray(result.data)) {
      throw new Error(result.message || "Не вдалося завантажити проєкти.");
    }

    setProjects(result.data);
  }

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError("");

        await Promise.all([loadCampaigns(), loadProjects()]);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Сталася помилка під час завантаження кампаній."
        );
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  function showPageNotice(type: NoticeType, text: string) {
    setPageNotice({ type, text });

    window.setTimeout(() => {
      setPageNotice(null);
    }, 3800);
  }

  function upsertCampaign(campaign: Campaign) {
    setCampaigns((current) => {
      const exists = current.some((item) => item.campaign_id === campaign.campaign_id);

      const next = exists
        ? current.map((item) =>
            item.campaign_id === campaign.campaign_id ? campaign : item
          )
        : [...current, campaign];

      return next.sort((a, b) => a.campaign_id - b.campaign_id);
    });
  }

  const activeProjects = useMemo(() => {
    return projects.filter((project) => !isFinalProjectStatus(project.status));
  }, [projects]);

  const selectedProject = useMemo(() => {
    return projects.find((project) => String(project.project_id) === form.project_id) || null;
  }, [form.project_id, projects]);

  const budgetInfo = useMemo(() => {
    return getBudgetInfo({
      form,
      projects,
      campaigns,
      editingCampaignId,
    });
  }, [campaigns, editingCampaignId, form, projects]);

  const launchMinDate = getLaunchMinDate(selectedProject, modalMode);
  const launchMaxDate = getLaunchMaxDate(selectedProject);
  const stopMaxDate = getStopMaxDate(form.launch_date || launchMinDate, selectedProject);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();

    let list = campaigns;

    if (statusFilter !== "all") {
      list = list.filter((item) => item.campaign_status === statusFilter);
    }

    if (channelFilter !== "all") {
      list = list.filter((item) => item.channel === channelFilter);
    }

    if (q) {
      list = list.filter(
        (item) =>
          item.channel.toLowerCase().includes(q) ||
          item.project_name.toLowerCase().includes(q) ||
          item.client_company.toLowerCase().includes(q) ||
          item.client_name.toLowerCase().includes(q)
      );
    }

    return list;
  }, [campaigns, channelFilter, query, statusFilter]);

  const totals = useMemo(() => {
    const active = campaigns.filter((item) => item.campaign_status === "запущено").length;
    const planned = campaigns.filter((item) => item.campaign_status === "заплановано").length;

    const activeBudget = campaigns
      .filter((item) => item.campaign_status !== "скасовано")
      .reduce((sum, item) => sum + Number(item.budget || 0), 0);

    return {
      total: campaigns.length,
      active,
      planned,
      activeBudget,
    };
  }, [campaigns]);

  const statusOptions = getAvailableStatusOptions(editingCampaign);

  function canEditCampaign(campaign: Campaign) {
    return getCampaignCapabilities(campaign).canEdit;
  }

  function openCreateModal() {
    const firstProject = activeProjects[0];
    const minLaunch = firstProject
      ? getLaunchMinDate(firstProject, "create")
      : getTodayISO();

    setModalMode("create");
    setEditingCampaignId(null);
    setEditingCampaign(null);
    setForm({
      ...emptyForm,
      project_id: firstProject ? String(firstProject.project_id) : "",
      launch_date: minLaunch,
      stop_date: "",
      campaign_status: "заплановано",
    });
    setFormError("");
    setFormSuccess("");
    setModalOpen(true);
  }

  function openEditModal(campaign: Campaign) {
    const safeStatus = isCampaignStatus(campaign.campaign_status)
      ? campaign.campaign_status
      : "заплановано";

    setModalMode("edit");
    setEditingCampaignId(campaign.campaign_id);
    setEditingCampaign(campaign);
    setForm({
      project_id: String(campaign.project_id),
      channel: channels.includes(campaign.channel as CampaignChannel)
        ? (campaign.channel as CampaignChannel)
        : "",
      launch_date: campaign.launch_date,
      stop_date: campaign.stop_date || "",
      budget: String(campaign.budget),
      campaign_status: safeStatus,
    });
    setFormError("");
    setFormSuccess("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setModalMode("create");
    setEditingCampaignId(null);
    setEditingCampaign(null);
    setForm({
      ...emptyForm,
      launch_date: getTodayISO(),
    });
    setFormError("");
    setFormSuccess("");
  }

  function updateForm<K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));

    setFormError("");
    setFormSuccess("");
  }

  function handleProjectChange(projectId: string) {
    const project = projects.find((item) => String(item.project_id) === projectId) || null;

    const minLaunch = getLaunchMinDate(project, modalMode);
    const maxLaunch = getLaunchMaxDate(project);

    setForm((current) => {
      const nextLaunch = clampDate(
        current.launch_date || minLaunch,
        minLaunch,
        maxLaunch
      );

      const nextStopMax = getStopMaxDate(nextLaunch, project);

      return {
        ...current,
        project_id: projectId,
        launch_date: nextLaunch,
        stop_date:
          current.stop_date && current.stop_date >= nextLaunch
            ? clampDate(current.stop_date, nextLaunch, nextStopMax)
            : "",
      };
    });

    setFormError("");
    setFormSuccess("");
  }

  function handleStatusChange(status: CampaignStatus) {
    setForm((current) => {
      const next = {
        ...current,
        campaign_status: status,
      };

      if (isFinalCampaignStatus(status) && !next.stop_date) {
        const minStop = next.launch_date || launchMinDate;
        const maxStop = getStopMaxDate(minStop, selectedProject);
        const wantedStop = getTodayISO() < minStop ? minStop : getTodayISO();

        next.stop_date = clampDate(wantedStop, minStop, maxStop);
      }

      if (!isFinalCampaignStatus(status) && current.stop_date && modalMode === "create") {
        next.stop_date = "";
      }

      return next;
    });

    setFormError("");
    setFormSuccess("");
  }

  async function handleSaveCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const preparedForm: CampaignForm = {
      ...form,
      budget: normalizeBudgetInput(form.budget),
      launch_date: form.launch_date.trim(),
      stop_date: form.stop_date.trim(),
      campaign_status: modalMode === "create" ? "заплановано" : form.campaign_status,
    };

    const validationError = validateCampaignForm({
      form: preparedForm,
      mode: modalMode,
      selectedProject,
      campaigns,
      editingCampaign,
      editingCampaignId,
    });

    if (validationError) {
      setForm(preparedForm);
      setFormError(validationError);
      return;
    }

    const isEditing = modalMode === "edit";

    if (isEditing && !editingCampaignId) {
      setFormError("Не вдалося визначити кампанію для редагування.");
      return;
    }

    try {
      setSaving(true);
      setFormError("");
      setFormSuccess("");

      const response = await fetch(
        isEditing ? `/api/campaigns/${editingCampaignId}` : "/api/campaigns",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            project_id: Number(preparedForm.project_id),
            channel: preparedForm.channel,
            launch_date: preparedForm.launch_date,
            stop_date: preparedForm.stop_date || null,
            budget: parseMoney(preparedForm.budget),
            campaign_status: preparedForm.campaign_status,
          }),
        }
      );

      const result = await readApiJson<ApiCampaignResponse>(response);

      if (!response.ok || !result.ok || !result.data) {
        throw new Error(
          result.message ||
            (isEditing
              ? "Не вдалося оновити кампанію."
              : "Не вдалося створити кампанію.")
        );
      }

      upsertCampaign(result.data);

      if (isEditing) {
        setEditingCampaign(result.data);
        setFormSuccess("Кампанію успішно оновлено.");
        showPageNotice("success", "Кампанію оновлено.");
      } else {
        const firstProject = activeProjects[0];
        const minLaunch = firstProject
          ? getLaunchMinDate(firstProject, "create")
          : getTodayISO();

        setForm({
          ...emptyForm,
          project_id: firstProject ? String(firstProject.project_id) : "",
          launch_date: minLaunch,
          stop_date: "",
          campaign_status: "заплановано",
        });

        setFormSuccess("Кампанію створено зі статусом «заплановано».");
        showPageNotice("success", "Нову кампанію створено.");
      }
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Сталася помилка під час збереження кампанії."
      );
    } finally {
      setSaving(false);
    }
  }

  function openActionModal(campaign: Campaign, action: CampaignAction) {
    setActionCampaign(campaign);
    setActionType(action);
    setActionError("");
    setActionSuccess("");
  }

  function closeActionModal() {
    if (actioning) return;

    setActionCampaign(null);
    setActionType("start");
    setActionError("");
    setActionSuccess("");
  }

  function getActionMeta(action: CampaignAction) {
    if (action === "start") {
      return {
        title: "Запустити кампанію?",
        status: "запущено" as CampaignStatus,
        icon: "play_arrow",
        button: "Так, запустити",
        success: "Кампанію запущено.",
        note: "Після запуску кампанія стане активною і зможе мати статистику.",
      };
    }

    if (action === "finish") {
      return {
        title: "Завершити кампанію?",
        status: "завершено" as CampaignStatus,
        icon: "done_all",
        button: "Так, завершити",
        success: "Кампанію завершено.",
        note: "Завершена кампанія буде заблокована від редагування.",
      };
    }

    if (action === "stop") {
      return {
        title: "Зупинити кампанію?",
        status: "зупинено" as CampaignStatus,
        icon: "pause",
        button: "Так, зупинити",
        success: "Кампанію зупинено.",
        note: "Зупинена кампанія залишається в історії CRM.",
      };
    }

    return {
      title: "Скасувати кампанію?",
      status: "скасовано" as CampaignStatus,
      icon: "block",
      button: "Так, скасувати",
      success: "Кампанію скасовано.",
      note: "Запис не буде видалено фізично з бази, а отримає статус «скасовано».",
    };
  }

  async function confirmAction() {
    if (!actionCampaign) return;

    const meta = getActionMeta(actionType);

    try {
      setActioning(true);
      setActionError("");
      setActionSuccess("");

      let response: Response;

      if (actionType === "cancel") {
        response = await fetch(`/api/campaigns/${actionCampaign.campaign_id}`, {
          method: "DELETE",
        });
      } else {
        const nextLaunchDate =
          actionType === "start"
            ? getSafeActionDate(actionCampaign)
            : actionCampaign.launch_date;

        const nextStopDate =
          actionType === "finish" || actionType === "stop"
            ? getSafeActionDate(actionCampaign)
            : actionCampaign.stop_date;

        response = await fetch(`/api/campaigns/${actionCampaign.campaign_id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            campaign_status: meta.status,
            launch_date: nextLaunchDate,
            stop_date: nextStopDate,
          }),
        });
      }

      const result = await readApiJson<ApiCampaignResponse>(response);

      if (!response.ok || !result.ok || !result.data) {
        throw new Error(result.message || "Не вдалося змінити статус кампанії.");
      }

      upsertCampaign(result.data);

      setActionSuccess(meta.success);
      showPageNotice("success", meta.success);

      window.setTimeout(() => {
        closeActionModal();
      }, 900);
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Сталася помилка під час зміни статусу кампанії."
      );
    } finally {
      setActioning(false);
    }
  }

  if (!allowedRoles.includes(role)) {
    return (
      <div className={styles.denied}>
        <span className="material-symbols-rounded">lock</span>
        <h2>Немає доступу</h2>
        <p>
          Розділ «Кампанії» доступний таргетологу, акаунт-менеджеру та директору.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.empty}>
        <span className="material-symbols-rounded">sync</span>
        <p>Завантажуємо кампанії з PostgreSQL...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.empty}>
        <span className="material-symbols-rounded">error</span>
        <p>{error}</p>
      </div>
    );
  }

  const modalTitle =
    modalMode === "create" ? "Створити кампанію" : "Редагувати кампанію";

  const modalDescription =
    modalMode === "create"
      ? "Оберіть проєкт, канал, бюджет і дату запуску. Нова кампанія завжди створюється зі статусом «заплановано»."
      : "Оновіть канал, бюджет, дати або статус. Фінальні кампанії заблоковані від редагування.";

  const finalLocked =
    editingCampaign !== null && isFinalCampaignStatus(editingCampaign.campaign_status);

  return (
    <>
      <div className={styles.page}>
        <header className={styles.head}>
          <div className={styles.headText}>
            <h1>Кампанії</h1>
            <p>
              Рекламні кампанії проєктів · Усього: {totals.total} · Запущено:{" "}
              {totals.active} · Бюджет: {formatMoney(totals.activeBudget)} грн
            </p>
          </div>

          <button className={styles.addButton} type="button" onClick={openCreateModal}>
            <span className="material-symbols-rounded">add</span>
            Нова кампанія
          </button>
        </header>

        <section className={styles.summaryGrid}>
          <article className={styles.summaryCard}>
            <span className={styles.summaryIcon}>
              <span className="material-symbols-rounded">campaign</span>
            </span>
            <div>
              <p>Усього</p>
              <strong>{totals.total}</strong>
            </div>
          </article>

          <article className={styles.summaryCard}>
            <span className={styles.summaryIcon}>
              <span className="material-symbols-rounded">play_circle</span>
            </span>
            <div>
              <p>Запущено</p>
              <strong>{totals.active}</strong>
            </div>
          </article>

          <article className={styles.summaryCard}>
            <span className={styles.summaryIcon}>
              <span className="material-symbols-rounded">event_upcoming</span>
            </span>
            <div>
              <p>Заплановано</p>
              <strong>{totals.planned}</strong>
            </div>
          </article>

          <article className={styles.summaryCard}>
            <span className={styles.summaryIcon}>
              <span className="material-symbols-rounded">payments</span>
            </span>
            <div>
              <p>Бюджет</p>
              <strong>{formatMoney(totals.activeBudget)} ₴</strong>
            </div>
          </article>
        </section>

        <div className={styles.toolbar}>
          <div className={styles.search}>
            <span className="material-symbols-rounded">search</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              type="text"
              placeholder="Пошук за каналом, проєктом або клієнтом..."
            />
          </div>

          <div className={styles.filterSelect}>
            <span className="material-symbols-rounded">flag</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">Всі статуси</option>
              {campaignStatuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterSelect}>
            <span className="material-symbols-rounded">hub</span>
            <select
              value={channelFilter}
              onChange={(event) => setChannelFilter(event.target.value)}
            >
              <option value="all">Всі канали</option>
              {channels.map((channel) => (
                <option key={channel} value={channel}>
                  {channel}
                </option>
              ))}
            </select>
          </div>
        </div>

        {pageNotice && (
          <div
            className={cx(
              styles.formMessage,
              pageNotice.type === "error"
                ? styles.formMessageError
                : styles.formMessageSuccess
            )}
          >
            <span className="material-symbols-rounded">
              {pageNotice.type === "error" ? "error" : "check_circle"}
            </span>
            {pageNotice.text}
          </div>
        )}

        {rows.length > 0 ? (
          <div className={styles.grid}>
            {rows.map((item) => {
              const channel = channelMeta(item.channel);
              const progress = periodProgress(item);
              const statusMeta = getStatusMeta(item.campaign_status);
              const capabilities = getCampaignCapabilities(item);

              return (
                <article className={styles.card} key={item.campaign_id}>
                  <div className={styles.cardHead}>
                    <span className={cx(styles.thumb, channel.cls)}>
                      <span className="material-symbols-rounded">{channel.icon}</span>
                    </span>

                    <div className={styles.chInfo}>
                      <span className={styles.channel}>{item.channel}</span>
                      <span className={styles.project}>{item.project_name}</span>
                    </div>

                    <span
                      className={cx(
                        styles.badge,
                        toneClass[statusTone[item.campaign_status] || statusMeta.tone]
                      )}
                    >
                      {item.campaign_status}
                    </span>
                  </div>

                  <div className={styles.period}>
                    <div className={styles.periodDates}>
                      <span className="material-symbols-rounded">date_range</span>
                      {formatDate(item.launch_date)} —{" "}
                      {item.stop_date ? formatDate(item.stop_date) : "без дати зупинки"}
                    </div>

                    <div className={styles.bar}>
                      <span
                        className={cx(
                          styles.barFill,
                          fillClass[item.campaign_status] || styles.fillNeutral
                        )}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className={styles.campaignMeta}>
                    <span>
                      <span className="material-symbols-rounded">business_center</span>
                      {item.client_company}
                    </span>

                    {capabilities.canStartLater && (
                      <span className={styles.warningMeta}>
                        <span className="material-symbols-rounded">schedule</span>
                        Запуск з {formatDate(item.launch_date)}
                      </span>
                    )}

                    {item.is_overdue && (
                      <span className={styles.warningMeta}>
                        <span className="material-symbols-rounded">warning</span>
                        Кампанія прострочена
                      </span>
                    )}
                  </div>

                  <div className={styles.footer}>
                    <div className={styles.budget}>
                      <span className={styles.budgetLabel}>Бюджет кампанії</span>
                      <span className={styles.budgetValue}>
                        {formatMoney(item.budget)} ₴
                      </span>
                    </div>

                    <div className={styles.cardActions}>
                      {capabilities.canStart && (
                        <button
                          className={cx(styles.btn, styles.btnPrimary)}
                          type="button"
                          onClick={() => openActionModal(item, "start")}
                        >
                          <span className="material-symbols-rounded">play_arrow</span>
                          Запустити
                        </button>
                      )}

                      {capabilities.canFinish && (
                        <button
                          className={cx(styles.btn, styles.btnPrimary)}
                          type="button"
                          onClick={() => openActionModal(item, "finish")}
                        >
                          <span className="material-symbols-rounded">done_all</span>
                          Завершити
                        </button>
                      )}

                      {capabilities.canStop && (
                        <button
                          className={cx(styles.btn, styles.btnOutline)}
                          type="button"
                          onClick={() => openActionModal(item, "stop")}
                        >
                          <span className="material-symbols-rounded">pause</span>
                          Зупинити
                        </button>
                      )}
                    </div>
                  </div>

                  <div className={styles.secondaryActions}>
                    <button
                      className={styles.smallAction}
                      type="button"
                      onClick={() => setDetailsCampaign(item)}
                    >
                      <span className="material-symbols-rounded">visibility</span>
                      Деталі
                    </button>

                    {canEditCampaign(item) && (
                      <button
                        className={styles.smallAction}
                        type="button"
                        onClick={() => openEditModal(item)}
                      >
                        <span className="material-symbols-rounded">edit</span>
                        Редагувати
                      </button>
                    )}

                    {capabilities.canCancel && (
                      <button
                        className={styles.smallActionDanger}
                        type="button"
                        onClick={() => openActionModal(item, "cancel")}
                      >
                        <span className="material-symbols-rounded">block</span>
                        Скасувати
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className={styles.empty}>
            <span className="material-symbols-rounded">campaign</span>
            <p>Кампаній не знайдено</p>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className={styles.modalOverlay} onMouseDown={closeModal}>
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="campaign-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHead}>
              <div>
                <span className={styles.modalKicker}>
                  {modalMode === "create"
                    ? "Новий запис PostgreSQL"
                    : "Оновлення запису PostgreSQL"}
                </span>

                <h2 id="campaign-modal-title">{modalTitle}</h2>
                <p>{modalDescription}</p>
              </div>

              <button className={styles.modalClose} type="button" onClick={closeModal}>
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>

            <form className={styles.form} onSubmit={handleSaveCampaign} noValidate>
              {modalMode === "create" && activeProjects.length === 0 && (
                <div className={styles.formInfo}>
                  <span className="material-symbols-rounded">info</span>
                  Немає активних проєктів для створення кампанії. Кампанії не можна
                  створювати для завершених, зупинених або скасованих проєктів.
                </div>
              )}

              {finalLocked && (
                <div className={styles.formInfo}>
                  <span className="material-symbols-rounded">lock</span>
                  Фінальна кампанія заблокована від редагування, щоб не порушити
                  історію CRM.
                </div>
              )}

              {budgetInfo && (
                <div
                  className={cx(
                    styles.budgetInfo,
                    budgetInfo.isOverLimit && styles.budgetInfoDanger
                  )}
                >
                  <span className="material-symbols-rounded">
                    {budgetInfo.isOverLimit ? "warning" : "account_balance_wallet"}
                  </span>
                  <div>
                    <strong>
                      Бюджет брифа: {formatMoney(budgetInfo.projectBudget)} грн
                    </strong>
                    <p>
                      Уже зайнято іншими кампаніями: {formatMoney(budgetInfo.used)} грн ·
                      Доступно до цієї кампанії: {formatMoney(budgetInfo.remaining)} грн
                    </p>
                  </div>
                </div>
              )}

              <div className={styles.formGrid}>
                <label className={cx(styles.field, styles.fieldWide)}>
                  <span>Проєкт</span>
                  <select
                    value={form.project_id}
                    onChange={(event) => handleProjectChange(event.target.value)}
                    disabled={modalMode === "edit" || finalLocked}
                  >
                    <option value="">Оберіть проєкт</option>

                    {modalMode === "create" &&
                      activeProjects.map((project) => (
                        <option value={project.project_id} key={project.project_id}>
                          #{project.project_id} · {project.project_name} ·{" "}
                          {project.client_company || project.client_name || "клієнт"}
                        </option>
                      ))}

                    {modalMode === "edit" && editingCampaign && (
                      <option value={editingCampaign.project_id}>
                        #{editingCampaign.project_id} · {editingCampaign.project_name}
                      </option>
                    )}
                  </select>
                </label>

                <label className={styles.field}>
                  <span>Канал</span>
                  <select
                    value={form.channel}
                    onChange={(event) =>
                      updateForm("channel", event.target.value as CampaignChannel | "")
                    }
                    disabled={finalLocked}
                  >
                    <option value="">Оберіть канал</option>
                    {channels.map((channel) => (
                      <option value={channel} key={channel}>
                        {channel}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.field}>
                  <span>Бюджет, грн</span>
                  <input
                    value={form.budget}
                    onChange={(event) =>
                      updateForm("budget", normalizeBudgetInput(event.target.value))
                    }
                    inputMode="decimal"
                    placeholder="12000"
                    disabled={finalLocked}
                  />
                </label>

                <label className={styles.field}>
                  <span>Дата запуску</span>
                  <input
                    value={form.launch_date}
                    onChange={(event) => updateForm("launch_date", event.target.value)}
                    type="date"
                    min={launchMinDate}
                    max={launchMaxDate}
                    disabled={finalLocked}
                  />
                </label>

                <label className={styles.field}>
                  <span>
                    Дата зупинки{" "}
                    {isFinalCampaignStatus(form.campaign_status)
                      ? "(обовʼязково)"
                      : "(необовʼязково)"}
                  </span>
                  <input
                    value={form.stop_date}
                    onChange={(event) => updateForm("stop_date", event.target.value)}
                    type="date"
                    min={form.launch_date || launchMinDate}
                    max={stopMaxDate}
                    disabled={finalLocked}
                  />
                </label>

                <label className={styles.field}>
                  <span>Статус</span>
                  <select
                    value={form.campaign_status}
                    onChange={(event) =>
                      handleStatusChange(event.target.value as CampaignStatus)
                    }
                    disabled={modalMode === "create" || finalLocked}
                  >
                    {statusOptions.map((status) => (
                      <option value={status.id} key={status.id}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {(formError || formSuccess) && (
                <div
                  className={cx(
                    styles.formMessage,
                    formError ? styles.formMessageError : styles.formMessageSuccess
                  )}
                >
                  <span className="material-symbols-rounded">
                    {formError ? "error" : "check_circle"}
                  </span>
                  {formError || formSuccess}
                </div>
              )}

              <div className={styles.modalActions}>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Скасувати
                </button>

                <button
                  className={styles.primaryButton}
                  type="submit"
                  disabled={
                    saving ||
                    finalLocked ||
                    Boolean(budgetInfo?.isOverLimit) ||
                    (modalMode === "create" && activeProjects.length === 0)
                  }
                >
                  <span className="material-symbols-rounded">
                    {saving ? "sync" : modalMode === "create" ? "add" : "save"}
                  </span>
                  {saving
                    ? "Збереження..."
                    : modalMode === "create"
                    ? "Створити кампанію"
                    : "Зберегти зміни"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {detailsCampaign && (
        <div
          className={styles.modalOverlay}
          onMouseDown={() => setDetailsCampaign(null)}
        >
          <section
            className={cx(styles.modal, styles.detailsModal)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="campaign-details-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHead}>
              <div>
                <span className={styles.modalKicker}>Деталі кампанії</span>
                <h2 id="campaign-details-title">
                  {detailsCampaign.channel} · {detailsCampaign.project_name}
                </h2>
                <p>
                  {detailsCampaign.client_company} · {detailsCampaign.campaign_status}
                </p>
              </div>

              <button
                className={styles.modalClose}
                type="button"
                onClick={() => setDetailsCampaign(null)}
              >
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>

            <div className={styles.detailsBody}>
              <div className={styles.detailsGrid}>
                <div>
                  <small>Статус</small>
                  <span
                    className={cx(
                      styles.badge,
                      toneClass[statusTone[detailsCampaign.campaign_status] || "info"]
                    )}
                  >
                    {detailsCampaign.campaign_status}
                  </span>
                </div>

                <div>
                  <small>Канал</small>
                  <strong>{detailsCampaign.channel}</strong>
                </div>

                <div>
                  <small>Бюджет</small>
                  <strong>{formatMoney(detailsCampaign.budget)} грн</strong>
                </div>

                <div>
                  <small>Проєкт</small>
                  <strong>{detailsCampaign.project_name}</strong>
                </div>

                <div>
                  <small>Клієнт</small>
                  <strong>{detailsCampaign.client_company}</strong>
                </div>

                <div>
                  <small>Бюджет брифа</small>
                  <strong>{formatMoney(detailsCampaign.brief_budget)} грн</strong>
                </div>

                <div>
                  <small>Дата запуску</small>
                  <strong>{formatDate(detailsCampaign.launch_date)}</strong>
                </div>

                <div>
                  <small>Дата зупинки</small>
                  <strong>{formatDate(detailsCampaign.stop_date)}</strong>
                </div>

                <div>
                  <small>Прогрес періоду</small>
                  <strong>{periodProgress(detailsCampaign)}%</strong>
                </div>
              </div>

              <div className={styles.modalActions}>
                {canEditCampaign(detailsCampaign) && (
                  <button
                    className={styles.primaryButton}
                    type="button"
                    onClick={() => {
                      setDetailsCampaign(null);
                      openEditModal(detailsCampaign);
                    }}
                  >
                    <span className="material-symbols-rounded">edit</span>
                    Редагувати
                  </button>
                )}

                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() => setDetailsCampaign(null)}
                >
                  Закрити
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {actionCampaign && (
        <div className={styles.modalOverlay} onMouseDown={closeActionModal}>
          <section
            className={cx(styles.modal, styles.confirmModal)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="campaign-action-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.confirmIcon}>
              <span className="material-symbols-rounded">
                {getActionMeta(actionType).icon}
              </span>
            </div>

            <div className={styles.confirmContent}>
              <span className={styles.modalKicker}>Зміна статусу PostgreSQL</span>

              <h2 id="campaign-action-title">{getActionMeta(actionType).title}</h2>

              <p>
                Кампанія <strong>{actionCampaign.channel}</strong> для проєкту{" "}
                <strong>{actionCampaign.project_name}</strong> отримає статус{" "}
                <strong>«{getActionMeta(actionType).status}»</strong>.
              </p>

              <p className={styles.confirmNote}>{getActionMeta(actionType).note}</p>

              {(actionError || actionSuccess) && (
                <div
                  className={cx(
                    styles.formMessage,
                    actionError ? styles.formMessageError : styles.formMessageSuccess
                  )}
                >
                  <span className="material-symbols-rounded">
                    {actionError ? "error" : "check_circle"}
                  </span>
                  {actionError || actionSuccess}
                </div>
              )}
            </div>

            <div className={styles.modalActions}>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={closeActionModal}
                disabled={actioning}
              >
                Назад
              </button>

              <button
                className={
                  actionType === "cancel" || actionType === "stop"
                    ? styles.dangerButton
                    : styles.primaryButton
                }
                type="button"
                onClick={confirmAction}
                disabled={actioning || Boolean(actionSuccess)}
              >
                <span className="material-symbols-rounded">
                  {actioning ? "sync" : getActionMeta(actionType).icon}
                </span>
                {actioning ? "Оновлення..." : getActionMeta(actionType).button}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}