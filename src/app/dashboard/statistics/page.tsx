"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Role, useDashboard } from "../layout";
import styles from "./page.module.css";

type PeriodFilter = "all" | "7" | "14" | "30";
type ModalMode = "create" | "edit";
type NoticeType = "success" | "error";

type Statistic = {
  statistic_id: number;

  campaign_id: number;
  channel: string;
  campaign_status: string;
  campaign_budget: number;
  campaign_launch_date: string;
  campaign_stop_date: string | null;

  project_id: number;
  project_name: string;
  project_status: string;

  brief_id: number;
  brief_budget: number;

  client_id: number;
  client_name: string;
  client_company: string;
  client_status: string;

  record_date: string;
  impressions: number;
  clicks: number;
  spent_amount: number;

  ctr: number;
  cpc: number;
  cpm: number;

  campaign_spent_total: number;
  campaign_budget_remaining: number;
  campaign_budget_used_percent: number;

  can_edit?: boolean;
  can_delete?: boolean;
};

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
  can_edit?: boolean;
};

type StatisticForm = {
  campaign_id: string;
  record_date: string;
  impressions: string;
  clicks: string;
  spent_amount: string;
};

type ApiStatisticsResponse = {
  ok: boolean;
  data?: Statistic[];
  message?: string;
};

type ApiStatisticResponse = {
  ok: boolean;
  data?: Statistic | { statistic_id: number } | null;
  message?: string;
};

type ApiCampaignsResponse = {
  ok: boolean;
  data?: Campaign[];
  message?: string;
};

const allowedRoles: Role[] = ["director", "ads"];

const periodOptions: { id: PeriodFilter; label: string }[] = [
  { id: "all", label: "Увесь період" },
  { id: "7", label: "7 днів" },
  { id: "14", label: "14 днів" },
  { id: "30", label: "30 днів" },
];

const blockedCampaignStatuses = ["заплановано", "скасовано"];
const finalCampaignStatuses = ["завершено", "зупинено", "скасовано"];

const MAX_IMPRESSIONS = 1_000_000_000;
const MAX_SPENT_AMOUNT = 10_000_000;
const MAX_CAMPAIGN_DURATION_DAYS = 370;

const emptyForm: StatisticForm = {
  campaign_id: "",
  record_date: "",
  impressions: "",
  clicks: "",
  spent_amount: "",
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

function minISODate(...dates: (string | null | undefined)[]) {
  const validDates = dates.filter(Boolean) as string[];

  if (validDates.length === 0) {
    return getTodayISO();
  }

  return validDates.sort()[0];
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("uk-UA", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("uk-UA", {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
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

function toUTC(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
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

function normalizeIntegerInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
}

function normalizeMoneyInput(value: string) {
  const cleaned = value.replace(/[^\d.,]/g, "").replace(",", ".");
  const parts = cleaned.split(".");

  if (parts.length <= 1) {
    return cleaned.slice(0, 10);
  }

  return `${parts[0].slice(0, 10)}.${parts.slice(1).join("").slice(0, 2)}`;
}

function parseInteger(value: string) {
  if (!/^\d+$/.test(value.trim())) {
    return Number.NaN;
  }

  return Number(value.trim());
}

function parseMoney(value: string) {
  const number = Number(value.replace(",", ".").trim());

  if (!Number.isFinite(number)) {
    return Number.NaN;
  }

  return Math.round(number * 100) / 100;
}

function getCtr(clicks: number, impressions: number) {
  if (!impressions) return 0;
  return (clicks / impressions) * 100;
}

function getCpc(spent: number, clicks: number) {
  if (!clicks) return 0;
  return spent / clicks;
}

function getCpm(spent: number, impressions: number) {
  if (!impressions) return 0;
  return (spent / impressions) * 1000;
}

function formatPercent(value: number) {
  return `${(Number.isFinite(value) ? value : 0).toFixed(2)}%`;
}

function channelIcon(channel: string) {
  const lower = channel.toLowerCase();

  if (lower.includes("instagram")) return "photo_camera";
  if (lower.includes("facebook")) return "groups";
  if (lower.includes("google")) return "search";
  if (lower.includes("meta")) return "hub";
  if (lower.includes("tiktok")) return "music_note";

  return "campaign";
}

function channelClass(channel: string) {
  const lower = channel.toLowerCase();

  if (lower.includes("instagram")) return styles.chInstagram;
  if (lower.includes("facebook")) return styles.chFacebook;
  if (lower.includes("google")) return styles.chGoogle;
  if (lower.includes("meta")) return styles.chMeta;
  if (lower.includes("tiktok")) return styles.chTiktok;

  return styles.chDefault;
}

function getStatisticMaxDate(campaign: Campaign | null) {
  if (!campaign) {
    return getTodayISO();
  }

  const hardMax = campaign.stop_date
    ? minISODate(
        campaign.stop_date,
        addDaysISO(campaign.launch_date, MAX_CAMPAIGN_DURATION_DAYS)
      )
    : addDaysISO(campaign.launch_date, MAX_CAMPAIGN_DURATION_DAYS);

  return minISODate(hardMax, getTodayISO());
}

function getCampaignSpentUsed(params: {
  statistics: Statistic[];
  campaignId: number;
  excludeStatisticId?: number | null;
}) {
  return params.statistics
    .filter((item) => {
      if (item.campaign_id !== params.campaignId) return false;

      if (
        params.excludeStatisticId &&
        item.statistic_id === params.excludeStatisticId
      ) {
        return false;
      }

      return true;
    })
    .reduce((sum, item) => sum + Number(item.spent_amount || 0), 0);
}

function getBudgetInfo(params: {
  form: StatisticForm;
  statistics: Statistic[];
  campaign: Campaign | null;
  editingStatisticId: number | null;
}) {
  if (!params.campaign) return null;

  const spent = parseMoney(params.form.spent_amount || "0");

  const used = getCampaignSpentUsed({
    statistics: params.statistics,
    campaignId: params.campaign.campaign_id,
    excludeStatisticId: params.editingStatisticId,
  });

  const total = Number.isFinite(spent) ? used + spent : used;
  const budget = Number(params.campaign.budget || 0);

  return {
    budget,
    used,
    total,
    remainingBeforeCurrent: Math.max(0, budget - used),
    remainingAfterCurrent: Math.max(0, budget - total),
    usedPercent: budget > 0 ? Math.min(100, (total / budget) * 100) : 0,
    isOverLimit: total > budget,
  };
}

function hasDuplicateDate(params: {
  statistics: Statistic[];
  campaignId: number;
  recordDate: string;
  editingStatisticId: number | null;
}) {
  return params.statistics.some((item) => {
    if (item.campaign_id !== params.campaignId) return false;
    if (item.record_date !== params.recordDate) return false;
    if (
      params.editingStatisticId &&
      item.statistic_id === params.editingStatisticId
    ) {
      return false;
    }

    return true;
  });
}

function validateStatisticForm(params: {
  form: StatisticForm;
  campaign: Campaign | null;
  statistics: Statistic[];
  editingStatisticId: number | null;
}) {
  const campaignId = Number(params.form.campaign_id);
  const recordDate = params.form.record_date.trim();
  const impressions = parseInteger(params.form.impressions || "0");
  const clicks = parseInteger(params.form.clicks || "0");
  const spentAmount = parseMoney(params.form.spent_amount || "0");

  if (!Number.isInteger(campaignId) || campaignId <= 0 || !params.campaign) {
    return "Оберіть коректну кампанію для статистики.";
  }

  if (blockedCampaignStatuses.includes(params.campaign.campaign_status)) {
    return "Не можна додавати статистику до запланованої або скасованої кампанії.";
  }

  if (!isRealISODate(recordDate)) {
    return "Вкажіть коректну дату статистики.";
  }

  if (recordDate > getTodayISO()) {
    return "Дата статистики не може бути в майбутньому.";
  }

  if (recordDate < params.campaign.launch_date) {
    return "Дата статистики не може бути раніше дати запуску кампанії.";
  }

  if (
    ["завершено", "зупинено"].includes(params.campaign.campaign_status) &&
    !params.campaign.stop_date
  ) {
    return "Фінальна кампанія має некоректні дані: відсутня дата зупинки.";
  }

  const maxDate = getStatisticMaxDate(params.campaign);

  if (recordDate > maxDate) {
    return `Дата статистики виходить за дозволений період кампанії. Максимальна дата: ${formatDate(
      maxDate
    )}.`;
  }

  if (!Number.isInteger(impressions) || impressions < 0) {
    return "Кількість показів має бути цілим числом від 0.";
  }

  if (impressions > MAX_IMPRESSIONS) {
    return "Кількість показів виглядає нереалістично великою.";
  }

  if (!Number.isInteger(clicks) || clicks < 0) {
    return "Кількість кліків має бути цілим числом від 0.";
  }

  if (clicks > impressions) {
    return "Кількість кліків не може бути більшою за кількість показів.";
  }

  if (!Number.isFinite(spentAmount) || spentAmount < 0) {
    return "Сума витрат має бути числом від 0.";
  }

  if (spentAmount > MAX_SPENT_AMOUNT) {
    return "Сума витрат виглядає нереалістично великою.";
  }

  if (impressions === 0 && clicks === 0 && spentAmount === 0) {
    return "Запис статистики не може бути повністю нульовим.";
  }

  if (
    hasDuplicateDate({
      statistics: params.statistics,
      campaignId,
      recordDate,
      editingStatisticId: params.editingStatisticId,
    })
  ) {
    return `Статистика для цієї кампанії за дату ${formatDate(
      recordDate
    )} вже існує.`;
  }

  const budgetInfo = getBudgetInfo({
    form: params.form,
    statistics: params.statistics,
    campaign: params.campaign,
    editingStatisticId: params.editingStatisticId,
  });

  if (budgetInfo?.isOverLimit) {
    return `Сумарні витрати за кампанією будуть ${formatMoney(
      budgetInfo.total
    )} грн, але бюджет кампанії становить ${formatMoney(budgetInfo.budget)} грн.`;
  }

  return "";
}

async function readApiJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error(
      "API повернув не JSON. Перевірте route.ts і запущений npm run dev."
    );
  }

  return (await response.json()) as T;
}

export default function StatisticsPage() {
  const { role } = useDashboard();

  const [statistics, setStatistics] = useState<Statistic[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [channel, setChannel] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editingStatisticId, setEditingStatisticId] = useState<number | null>(null);
  const [editingStatistic, setEditingStatistic] = useState<Statistic | null>(null);

  const [form, setForm] = useState<StatisticForm>({
    ...emptyForm,
    record_date: getTodayISO(),
  });

  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const [detailsStatistic, setDetailsStatistic] = useState<Statistic | null>(null);

  const [deleteStatistic, setDeleteStatistic] = useState<Statistic | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleteSuccess, setDeleteSuccess] = useState("");

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [pageNotice, setPageNotice] = useState<{
    type: NoticeType;
    text: string;
  } | null>(null);

  async function loadStatistics() {
    const response = await fetch("/api/statistics", {
      cache: "no-store",
    });

    const result = await readApiJson<ApiStatisticsResponse>(response);

    if (!response.ok || !result.ok || !Array.isArray(result.data)) {
      throw new Error(result.message || "Не вдалося завантажити статистику.");
    }

    setStatistics(result.data);
  }

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

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError("");

        await Promise.all([loadStatistics(), loadCampaigns()]);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Сталася помилка під час завантаження статистики."
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

  function upsertStatistic(statistic: Statistic) {
    setStatistics((current) => {
      const exists = current.some((item) => item.statistic_id === statistic.statistic_id);

      const next = exists
        ? current.map((item) =>
            item.statistic_id === statistic.statistic_id ? statistic : item
          )
        : [...current, statistic];

      return next.sort((a, b) => {
        if (a.record_date === b.record_date) {
          return b.statistic_id - a.statistic_id;
        }

        return toUTC(b.record_date) - toUTC(a.record_date);
      });
    });
  }

  function removeStatistic(statisticId: number) {
    setStatistics((current) =>
      current.filter((item) => item.statistic_id !== statisticId)
    );
  }

  const availableCampaigns = useMemo(() => {
    return campaigns.filter((item) => {
      if (blockedCampaignStatuses.includes(item.campaign_status)) {
        return false;
      }

      if (
        ["завершено", "зупинено"].includes(item.campaign_status) &&
        !item.stop_date
      ) {
        return false;
      }

      return true;
    });
  }, [campaigns]);

  const selectedCampaign = useMemo(() => {
    return (
      campaigns.find((item) => String(item.campaign_id) === form.campaign_id) ||
      null
    );
  }, [campaigns, form.campaign_id]);

  const budgetInfo = useMemo(() => {
    return getBudgetInfo({
      form,
      statistics,
      campaign: selectedCampaign,
      editingStatisticId,
    });
  }, [editingStatisticId, form, selectedCampaign, statistics]);

  const recordMinDate = selectedCampaign?.launch_date || "";
  const recordMaxDate = getStatisticMaxDate(selectedCampaign);

  const channels = useMemo(() => {
    return Array.from(new Set(statistics.map((item) => item.channel))).sort();
  }, [statistics]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const today = toUTC(getTodayISO());

    return statistics.filter((item) => {
      const recordTime = toUTC(item.record_date);

      const matchPeriod =
        period === "all" ||
        today - recordTime <= Number(period) * 24 * 60 * 60 * 1000;

      const matchChannel = channel === "all" || item.channel === channel;

      const matchQuery =
        !q ||
        item.project_name.toLowerCase().includes(q) ||
        item.channel.toLowerCase().includes(q) ||
        item.client_company.toLowerCase().includes(q) ||
        String(item.campaign_id).includes(q);

      return matchPeriod && matchChannel && matchQuery;
    });
  }, [channel, period, query, statistics]);

  const totals = useMemo(() => {
    const impressions = filtered.reduce((sum, item) => sum + item.impressions, 0);
    const clicks = filtered.reduce((sum, item) => sum + item.clicks, 0);
    const spent = filtered.reduce((sum, item) => sum + item.spent_amount, 0);
    const ctr = getCtr(clicks, impressions);
    const cpc = getCpc(spent, clicks);
    const cpm = getCpm(spent, impressions);

    return {
      impressions,
      clicks,
      spent,
      ctr,
      cpc,
      cpm,
    };
  }, [filtered]);

  const chartRows = useMemo(() => {
    const map = new Map<
      string,
      {
        record_date: string;
        impressions: number;
        clicks: number;
        spent_amount: number;
      }
    >();

    filtered.forEach((item) => {
      const current = map.get(item.record_date);

      if (!current) {
        map.set(item.record_date, {
          record_date: item.record_date,
          impressions: item.impressions,
          clicks: item.clicks,
          spent_amount: item.spent_amount,
        });
        return;
      }

      current.impressions += item.impressions;
      current.clicks += item.clicks;
      current.spent_amount += item.spent_amount;
    });

    const rows = Array.from(map.values()).sort(
      (a, b) => toUTC(a.record_date) - toUTC(b.record_date)
    );

    const maxImpressions = Math.max(...rows.map((item) => item.impressions), 1);

    return rows.map((item) => ({
      ...item,
      ctr: getCtr(item.clicks, item.impressions),
      height: Math.max(8, Math.round((item.impressions / maxImpressions) * 100)),
    }));
  }, [filtered]);

  function openCreateModal() {
    const firstCampaign = availableCampaigns[0];
    const defaultDate = firstCampaign
      ? minISODate(getTodayISO(), getStatisticMaxDate(firstCampaign))
      : getTodayISO();

    setModalMode("create");
    setEditingStatisticId(null);
    setEditingStatistic(null);
    setForm({
      ...emptyForm,
      campaign_id: firstCampaign ? String(firstCampaign.campaign_id) : "",
      record_date:
        firstCampaign && defaultDate < firstCampaign.launch_date
          ? firstCampaign.launch_date
          : defaultDate,
    });
    setFormError("");
    setFormSuccess("");
    setModalOpen(true);
  }

  function openEditModal(statistic: Statistic) {
    setModalMode("edit");
    setEditingStatisticId(statistic.statistic_id);
    setEditingStatistic(statistic);
    setForm({
      campaign_id: String(statistic.campaign_id),
      record_date: statistic.record_date,
      impressions: String(statistic.impressions),
      clicks: String(statistic.clicks),
      spent_amount: String(statistic.spent_amount),
    });
    setFormError("");
    setFormSuccess("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setModalMode("create");
    setEditingStatisticId(null);
    setEditingStatistic(null);
    setForm({
      ...emptyForm,
      record_date: getTodayISO(),
    });
    setFormError("");
    setFormSuccess("");
  }

  function updateForm<K extends keyof StatisticForm>(
    key: K,
    value: StatisticForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));

    setFormError("");
    setFormSuccess("");
  }

  function handleCampaignChange(campaignId: string) {
    const campaign =
      campaigns.find((item) => String(item.campaign_id) === campaignId) || null;

    setForm((current) => {
      if (!campaign) {
        return {
          ...current,
          campaign_id: campaignId,
          record_date: getTodayISO(),
        };
      }

      const minDate = campaign.launch_date;
      const maxDate = getStatisticMaxDate(campaign);
      const preferredDate = current.record_date || getTodayISO();

      return {
        ...current,
        campaign_id: campaignId,
        record_date:
          preferredDate < minDate
            ? minDate
            : preferredDate > maxDate
            ? maxDate
            : preferredDate,
      };
    });

    setFormError("");
    setFormSuccess("");
  }

  async function handleSaveStatistic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const preparedForm: StatisticForm = {
      campaign_id: form.campaign_id.trim(),
      record_date: form.record_date.trim(),
      impressions: normalizeIntegerInput(form.impressions || "0"),
      clicks: normalizeIntegerInput(form.clicks || "0"),
      spent_amount: normalizeMoneyInput(form.spent_amount || "0"),
    };

    const validationError = validateStatisticForm({
      form: preparedForm,
      campaign: selectedCampaign,
      statistics,
      editingStatisticId,
    });

    if (validationError) {
      setForm(preparedForm);
      setFormError(validationError);
      return;
    }

    const isEditing = modalMode === "edit";

    if (isEditing && !editingStatisticId) {
      setFormError("Не вдалося визначити запис статистики для редагування.");
      return;
    }

    try {
      setSaving(true);
      setFormError("");
      setFormSuccess("");

      const response = await fetch(
        isEditing ? `/api/statistics/${editingStatisticId}` : "/api/statistics",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            campaign_id: Number(preparedForm.campaign_id),
            record_date: preparedForm.record_date,
            impressions: parseInteger(preparedForm.impressions),
            clicks: parseInteger(preparedForm.clicks),
            spent_amount: parseMoney(preparedForm.spent_amount),
          }),
        }
      );

      const result = await readApiJson<ApiStatisticResponse>(response);

      if (!response.ok || !result.ok || !result.data || !("record_date" in result.data)) {
        throw new Error(
          result.message ||
            (isEditing
              ? "Не вдалося оновити статистику."
              : "Не вдалося створити статистику.")
        );
      }

      upsertStatistic(result.data);

      if (isEditing) {
        setEditingStatistic(result.data);
        setFormSuccess("Статистику успішно оновлено.");
        showPageNotice("success", "Статистику оновлено.");
      } else {
        setForm({
          ...emptyForm,
          campaign_id: preparedForm.campaign_id,
          record_date: preparedForm.record_date,
        });
        setFormSuccess("Статистику успішно додано.");
        showPageNotice("success", "Новий запис статистики додано.");
      }
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Сталася помилка під час збереження статистики."
      );
    } finally {
      setSaving(false);
    }
  }

  function openDeleteModal(statistic: Statistic) {
    setDeleteStatistic(statistic);
    setDeleteError("");
    setDeleteSuccess("");
  }

  function closeDeleteModal() {
    if (deleting) return;

    setDeleteStatistic(null);
    setDeleteError("");
    setDeleteSuccess("");
  }

  async function confirmDeleteStatistic() {
    if (!deleteStatistic) return;

    try {
      setDeleting(true);
      setDeleteError("");
      setDeleteSuccess("");

      const response = await fetch(`/api/statistics/${deleteStatistic.statistic_id}`, {
        method: "DELETE",
      });

      const result = await readApiJson<ApiStatisticResponse>(response);

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Не вдалося видалити статистику.");
      }

      removeStatistic(deleteStatistic.statistic_id);
      setDeleteSuccess("Запис статистики видалено.");
      showPageNotice("success", "Запис статистики видалено.");

      window.setTimeout(() => {
        closeDeleteModal();
      }, 850);
    } catch (err) {
      setDeleteError(
        err instanceof Error
          ? err.message
          : "Сталася помилка під час видалення статистики."
      );
    } finally {
      setDeleting(false);
    }
  }

  function exportCsv() {
    const rows = [
      [
        "statistic_id",
        "campaign_id",
        "project_name",
        "client_company",
        "channel",
        "record_date",
        "impressions",
        "clicks",
        "ctr",
        "cpc",
        "cpm",
        "spent_amount",
      ],
      ...filtered.map((item) => [
        item.statistic_id,
        item.campaign_id,
        item.project_name,
        item.client_company,
        item.channel,
        item.record_date,
        item.impressions,
        item.clicks,
        item.ctr.toFixed(2),
        item.cpc.toFixed(2),
        item.cpm.toFixed(2),
        item.spent_amount.toFixed(2),
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(";")
      )
      .join("\n");

    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `adflow-statistics-${getTodayISO()}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  }

  if (!allowedRoles.includes(role)) {
    return (
      <div className={styles.denied}>
        <span className="material-symbols-rounded">lock</span>
        <h2>Немає доступу</h2>
        <p>
          Розділ «Статистика» доступний лише директору та спеціалісту з реклами.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.empty}>
        <span className="material-symbols-rounded">sync</span>
        <p>Завантажуємо статистику з PostgreSQL...</p>
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
    modalMode === "create" ? "Додати статистику" : "Редагувати статистику";

  const modalDescription =
    modalMode === "create"
      ? "Оберіть кампанію, дату та внесіть покази, кліки й витрати. Один запис на одну дату кампанії."
      : "Оновіть значення статистики. Кампанію змінювати не можна, щоб не порушити зв’язок campaign → statistic.";

  const selectedCtr = getCtr(
    parseInteger(form.clicks || "0") || 0,
    parseInteger(form.impressions || "0") || 0
  );

  const selectedCpc = getCpc(
    parseMoney(form.spent_amount || "0") || 0,
    parseInteger(form.clicks || "0") || 0
  );

  return (
    <>
      <div className={styles.page}>
        <header className={styles.head}>
          <div className={styles.headText}>
            <h1>Статистика</h1>
            <p>
              Аналітика рекламних кампаній з PostgreSQL: покази, кліки, CTR, CPC,
              CPM та витрати
            </p>
          </div>

          <div className={styles.headActions}>
            <button
              className={styles.secondaryTopButton}
              type="button"
              onClick={exportCsv}
              disabled={filtered.length === 0}
            >
              <span className="material-symbols-rounded">download</span>
              Експорт CSV
            </button>

            <button className={styles.addButton} type="button" onClick={openCreateModal}>
              <span className="material-symbols-rounded">add_chart</span>
              Додати статистику
            </button>
          </div>
        </header>

        <div className={styles.toolbar}>
          <div className={styles.search}>
            <span className="material-symbols-rounded">search</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              type="text"
              placeholder="Пошук за кампанією, клієнтом, каналом або ID..."
            />
          </div>

          <div className={styles.filterSelect}>
            <span className="material-symbols-rounded">date_range</span>
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value as PeriodFilter)}
            >
              {periodOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterSelect}>
            <span className="material-symbols-rounded">hub</span>
            <select
              value={channel}
              onChange={(event) => setChannel(event.target.value)}
            >
              <option value="all">Всі канали</option>
              {channels.map((item) => (
                <option key={item} value={item}>
                  {item}
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

        <section className={styles.kpiGrid}>
          <article className={styles.kpiCard}>
            <span className={styles.kpiIcon}>
              <span className="material-symbols-rounded">visibility</span>
            </span>

            <div>
              <p>Покази</p>
              <strong>{formatNumber(totals.impressions)}</strong>
            </div>
          </article>

          <article className={styles.kpiCard}>
            <span className={styles.kpiIcon}>
              <span className="material-symbols-rounded">ads_click</span>
            </span>

            <div>
              <p>Кліки</p>
              <strong>{formatNumber(totals.clicks)}</strong>
            </div>
          </article>

          <article className={styles.kpiCard}>
            <span className={styles.kpiIcon}>
              <span className="material-symbols-rounded">percent</span>
            </span>

            <div>
              <p>CTR</p>
              <strong>{formatPercent(totals.ctr)}</strong>
            </div>
          </article>

          <article className={styles.kpiCard}>
            <span className={styles.kpiIcon}>
              <span className="material-symbols-rounded">payments</span>
            </span>

            <div>
              <p>Витрати</p>
              <strong>{formatMoney(totals.spent)} ₴</strong>
            </div>
          </article>
        </section>

        <section className={styles.analyticsGrid}>
          <article className={styles.chartCard}>
            <div className={styles.cardHead}>
              <div>
                <h2>Динаміка показів</h2>
                <p>Агреговані дані за датами з таблиці statistic</p>
              </div>

              <span className={styles.badge}>
                CPC {totals.cpc.toFixed(2)} ₴ · CPM {totals.cpm.toFixed(2)} ₴
              </span>
            </div>

            {chartRows.length > 0 ? (
              <div className={styles.chart}>
                {chartRows.map((item) => (
                  <div className={styles.chartItem} key={item.record_date}>
                    <div className={styles.chartValue}>
                      {formatNumber(item.impressions)}
                    </div>

                    <div className={styles.chartBar}>
                      <span style={{ height: `${item.height}%` }} />
                    </div>

                    <div className={styles.chartDate}>{formatDate(item.record_date)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyCompact}>
                <span className="material-symbols-rounded">bar_chart_off</span>
                <p>Немає даних для графіка</p>
              </div>
            )}
          </article>

          <article className={styles.channelsCard}>
            <div className={styles.cardHead}>
              <div>
                <h2>Канали</h2>
                <p>Розподіл активності за рекламними майданчиками</p>
              </div>
            </div>

            <div className={styles.channelList}>
              {channels.map((item) => {
                const channelRows = filtered.filter((row) => row.channel === item);
                const impressions = channelRows.reduce(
                  (sum, row) => sum + row.impressions,
                  0
                );
                const clicks = channelRows.reduce((sum, row) => sum + row.clicks, 0);
                const spent = channelRows.reduce(
                  (sum, row) => sum + row.spent_amount,
                  0
                );

                return (
                  <div className={styles.channelRow} key={item}>
                    <span className={cx(styles.channelIcon, channelClass(item))}>
                      <span className="material-symbols-rounded">
                        {channelIcon(item)}
                      </span>
                    </span>

                    <div className={styles.channelInfo}>
                      <strong>{item}</strong>
                      <span>
                        {formatNumber(clicks)} кліків · CTR{" "}
                        {formatPercent(getCtr(clicks, impressions))}
                      </span>
                    </div>

                    <div className={styles.channelMoney}>
                      {formatMoney(spent)} ₴
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        </section>

        <section className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Дата</th>
                <th>Кампанія</th>
                <th>Канал</th>
                <th>Покази</th>
                <th>Кліки</th>
                <th>CTR</th>
                <th>CPC</th>
                <th>Витрати</th>
                <th>Дії</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((item) => (
                <tr key={item.statistic_id}>
                  <td>{formatDate(item.record_date)}</td>

                  <td>
                    <div className={styles.projectCell}>
                      <strong>{item.project_name}</strong>
                      <span>
                        campaign_id: {item.campaign_id} · {item.client_company}
                      </span>
                    </div>
                  </td>

                  <td>
                    <span className={styles.channelBadge}>
                      <span
                        className={cx(styles.channelDot, channelClass(item.channel))}
                      />
                      {item.channel}
                    </span>
                  </td>

                  <td>{formatNumber(item.impressions)}</td>
                  <td>{formatNumber(item.clicks)}</td>
                  <td>{formatPercent(item.ctr)}</td>
                  <td>{item.cpc.toFixed(2)} ₴</td>
                  <td>{formatMoney(item.spent_amount)} ₴</td>

                  <td>
                    <div className={styles.actionCell}>
                      <button
                        className={styles.iconButton}
                        type="button"
                        onClick={() => setDetailsStatistic(item)}
                        title="Деталі"
                      >
                        <span className="material-symbols-rounded">visibility</span>
                      </button>

                      {item.can_edit !== false && (
                        <button
                          className={styles.iconButton}
                          type="button"
                          onClick={() => openEditModal(item)}
                          title="Редагувати"
                        >
                          <span className="material-symbols-rounded">edit</span>
                        </button>
                      )}

                      {item.can_delete !== false && (
                        <button
                          className={styles.iconButtonDanger}
                          type="button"
                          onClick={() => openDeleteModal(item)}
                          title="Видалити"
                        >
                          <span className="material-symbols-rounded">delete</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className={styles.empty}>
              <span className="material-symbols-rounded">query_stats</span>
              <p>За вибраними фільтрами статистику не знайдено.</p>
            </div>
          )}
        </section>
      </div>

      {modalOpen && (
        <div className={styles.modalOverlay} onMouseDown={closeModal}>
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="statistic-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHead}>
              <div>
                <span className={styles.modalKicker}>
                  {modalMode === "create"
                    ? "Новий запис PostgreSQL"
                    : "Оновлення запису PostgreSQL"}
                </span>

                <h2 id="statistic-modal-title">{modalTitle}</h2>
                <p>{modalDescription}</p>
              </div>

              <button className={styles.modalClose} type="button" onClick={closeModal}>
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>

            <form className={styles.form} onSubmit={handleSaveStatistic} noValidate>
              {availableCampaigns.length === 0 && modalMode === "create" && (
                <div className={styles.formInfo}>
                  <span className="material-symbols-rounded">info</span>
                  Немає кампаній, до яких можна додати статистику. Статистика не
                  додається до запланованих або скасованих кампаній.
                </div>
              )}

              {budgetInfo && selectedCampaign && (
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
                      Бюджет кампанії: {formatMoney(budgetInfo.budget)} грн
                    </strong>
                    <p>
                      Уже витрачено без цього запису:{" "}
                      {formatMoney(budgetInfo.used)} грн · Після збереження:{" "}
                      {formatMoney(budgetInfo.total)} грн · Залишок:{" "}
                      {formatMoney(budgetInfo.remainingAfterCurrent)} грн
                    </p>

                    <div className={styles.budgetBar}>
                      <span style={{ width: `${budgetInfo.usedPercent}%` }} />
                    </div>
                  </div>
                </div>
              )}

              <div className={styles.formGrid}>
                <label className={cx(styles.field, styles.fieldWide)}>
                  <span>Кампанія</span>
                  <select
                    value={form.campaign_id}
                    onChange={(event) => handleCampaignChange(event.target.value)}
                    disabled={modalMode === "edit"}
                  >
                    <option value="">Оберіть кампанію</option>

                    {modalMode === "create" &&
                      availableCampaigns.map((campaign) => (
                        <option value={campaign.campaign_id} key={campaign.campaign_id}>
                          #{campaign.campaign_id} · {campaign.channel} ·{" "}
                          {campaign.project_name} · {campaign.client_company}
                        </option>
                      ))}

                    {modalMode === "edit" && editingStatistic && (
                      <option value={editingStatistic.campaign_id}>
                        #{editingStatistic.campaign_id} · {editingStatistic.channel} ·{" "}
                        {editingStatistic.project_name}
                      </option>
                    )}
                  </select>
                </label>

                <label className={styles.field}>
                  <span>Дата статистики</span>
                  <input
                    value={form.record_date}
                    onChange={(event) => updateForm("record_date", event.target.value)}
                    type="date"
                    min={recordMinDate || undefined}
                    max={recordMaxDate}
                  />
                </label>

                <label className={styles.field}>
                  <span>Покази</span>
                  <input
                    value={form.impressions}
                    onChange={(event) =>
                      updateForm("impressions", normalizeIntegerInput(event.target.value))
                    }
                    inputMode="numeric"
                    placeholder="18400"
                  />
                </label>

                <label className={styles.field}>
                  <span>Кліки</span>
                  <input
                    value={form.clicks}
                    onChange={(event) =>
                      updateForm("clicks", normalizeIntegerInput(event.target.value))
                    }
                    inputMode="numeric"
                    placeholder="842"
                  />
                </label>

                <label className={styles.field}>
                  <span>Витрати, грн</span>
                  <input
                    value={form.spent_amount}
                    onChange={(event) =>
                      updateForm(
                        "spent_amount",
                        normalizeMoneyInput(event.target.value)
                      )
                    }
                    inputMode="decimal"
                    placeholder="2100"
                  />
                </label>
              </div>

              <div className={styles.calculatedBox}>
                <div>
                  <small>CTR</small>
                  <strong>{formatPercent(selectedCtr)}</strong>
                </div>

                <div>
                  <small>CPC</small>
                  <strong>{selectedCpc.toFixed(2)} грн</strong>
                </div>

                <div>
                  <small>Дозволений період</small>
                  <strong>
                    {selectedCampaign
                      ? `${formatDate(selectedCampaign.launch_date)} — ${formatDate(
                          recordMaxDate
                        )}`
                      : "—"}
                  </strong>
                </div>
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
                    Boolean(budgetInfo?.isOverLimit) ||
                    (modalMode === "create" && availableCampaigns.length === 0)
                  }
                >
                  <span className="material-symbols-rounded">
                    {saving ? "sync" : modalMode === "create" ? "add_chart" : "save"}
                  </span>
                  {saving
                    ? "Збереження..."
                    : modalMode === "create"
                    ? "Додати статистику"
                    : "Зберегти зміни"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {detailsStatistic && (
        <div
          className={styles.modalOverlay}
          onMouseDown={() => setDetailsStatistic(null)}
        >
          <section
            className={cx(styles.modal, styles.detailsModal)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="statistic-details-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHead}>
              <div>
                <span className={styles.modalKicker}>Деталі статистики</span>
                <h2 id="statistic-details-title">
                  {detailsStatistic.channel} · {detailsStatistic.project_name}
                </h2>
                <p>
                  {detailsStatistic.client_company} ·{" "}
                  {formatDate(detailsStatistic.record_date)}
                </p>
              </div>

              <button
                className={styles.modalClose}
                type="button"
                onClick={() => setDetailsStatistic(null)}
              >
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>

            <div className={styles.detailsBody}>
              <div className={styles.detailsGrid}>
                <div>
                  <small>Покази</small>
                  <strong>{formatNumber(detailsStatistic.impressions)}</strong>
                </div>

                <div>
                  <small>Кліки</small>
                  <strong>{formatNumber(detailsStatistic.clicks)}</strong>
                </div>

                <div>
                  <small>CTR</small>
                  <strong>{formatPercent(detailsStatistic.ctr)}</strong>
                </div>

                <div>
                  <small>CPC</small>
                  <strong>{detailsStatistic.cpc.toFixed(2)} грн</strong>
                </div>

                <div>
                  <small>CPM</small>
                  <strong>{detailsStatistic.cpm.toFixed(2)} грн</strong>
                </div>

                <div>
                  <small>Витрати</small>
                  <strong>{formatMoney(detailsStatistic.spent_amount)} грн</strong>
                </div>

                <div>
                  <small>Бюджет кампанії</small>
                  <strong>{formatMoney(detailsStatistic.campaign_budget)} грн</strong>
                </div>

                <div>
                  <small>Витрачено всього</small>
                  <strong>
                    {formatMoney(detailsStatistic.campaign_spent_total)} грн
                  </strong>
                </div>

                <div>
                  <small>Залишок</small>
                  <strong>
                    {formatMoney(detailsStatistic.campaign_budget_remaining)} грн
                  </strong>
                </div>
              </div>

              <div className={styles.modalActions}>
                {detailsStatistic.can_edit !== false && (
                  <button
                    className={styles.primaryButton}
                    type="button"
                    onClick={() => {
                      setDetailsStatistic(null);
                      openEditModal(detailsStatistic);
                    }}
                  >
                    <span className="material-symbols-rounded">edit</span>
                    Редагувати
                  </button>
                )}

                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() => setDetailsStatistic(null)}
                >
                  Закрити
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {deleteStatistic && (
        <div className={styles.modalOverlay} onMouseDown={closeDeleteModal}>
          <section
            className={cx(styles.modal, styles.confirmModal)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-statistic-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.confirmIcon}>
              <span className="material-symbols-rounded">
                {deleteSuccess ? "check_circle" : "delete"}
              </span>
            </div>

            <div className={styles.confirmContent}>
              <span className={styles.modalKicker}>Видалення запису PostgreSQL</span>
              <h2 id="delete-statistic-title">Видалити статистику?</h2>

              <p>
                Запис за <strong>{formatDate(deleteStatistic.record_date)}</strong>{" "}
                для кампанії <strong>{deleteStatistic.channel}</strong> буде видалено
                з бази.
              </p>

              <p className={styles.confirmNote}>
                Видалення заборонене для фінальних кампаній. Якщо backend відмовить —
                запис залишиться без змін.
              </p>

              {(deleteError || deleteSuccess) && (
                <div
                  className={cx(
                    styles.formMessage,
                    deleteError ? styles.formMessageError : styles.formMessageSuccess
                  )}
                >
                  <span className="material-symbols-rounded">
                    {deleteError ? "error" : "check_circle"}
                  </span>
                  {deleteError || deleteSuccess}
                </div>
              )}
            </div>

            <div className={styles.modalActions}>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={closeDeleteModal}
                disabled={deleting}
              >
                Скасувати
              </button>

              <button
                className={styles.dangerButton}
                type="button"
                onClick={confirmDeleteStatistic}
                disabled={deleting || Boolean(deleteSuccess)}
              >
                <span className="material-symbols-rounded">
                  {deleting ? "sync" : "delete"}
                </span>
                {deleting ? "Видалення..." : "Так, видалити"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}