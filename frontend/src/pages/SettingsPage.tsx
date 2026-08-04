import { ReactNode, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  InputAdornment,
  IconButton,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import {
  Add,
  AutoAwesome,
  AutoGraphOutlined,
  BlockOutlined,
  BusinessOutlined,
  CableOutlined,
  CheckCircle,
  CheckCircleOutline,
  CloudUploadOutlined,
  CorporateFareOutlined,
  EditOutlined,
  FilterList,
  GavelOutlined,
  HelpOutline,
  History,
  InfoOutlined,
  LibraryBooksOutlined,
  LockOutlined,
  MoreVert,
  PendingOutlined,
  PictureAsPdfOutlined,
  PsychologyOutlined,
  Refresh,
  SaveOutlined,
  Search,
  SettingsOutlined,
  ShieldOutlined,
  TuneOutlined,
  VisibilityOffOutlined,
  VisibilityOutlined,
  WarningAmberOutlined,
} from "@mui/icons-material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, Company } from "../api";

const colors = {
  border: "#E5E7EB",
  canvas: "#F7F9FB",
  soft: "#F2F4F6",
  text: "#101828",
  secondary: "#667085",
  primary: "#0056B0",
  primarySoft: "#EFF6FF",
  success: "#16A34A",
  warning: "#F59E0B",
  error: "#BA1A1A",
};

const cardSx = {
  borderColor: colors.border,
  borderRadius: "12px",
  bgcolor: "#FFF",
  overflow: "hidden",
};
const cardHeaderSx = {
  px: 3,
  py: 2,
  borderBottom: `1px solid ${colors.border}`,
  bgcolor: "#FFF",
};
const fieldSx = {
  "& .MuiOutlinedInput-root": {
    minHeight: 44,
    borderRadius: "8px",
    bgcolor: colors.canvas,
  },
  "& .MuiOutlinedInput-notchedOutline": { borderColor: colors.border },
  "& .MuiFormHelperText-root": {
    mx: 0,
    mt: 0.75,
    fontSize: 12,
    lineHeight: 1.45,
  },
};
const smallFieldSx = {
  ...fieldSx,
  "& .MuiOutlinedInput-root": {
    minHeight: 40,
    borderRadius: "8px",
    bgcolor: "#FFF",
  },
};

type CompanyMutation = {
  mutate: (form: HTMLFormElement) => void;
  isPending: boolean;
  isError: boolean;
};

export function SettingsPage() {
  const [tab, setTab] = useState(0);
  const queryClient = useQueryClient();
  const companies = useQuery({
    queryKey: ["companies"],
    queryFn: async () => (await api.get<Company[]>("/companies")).data,
  });
  const createCompany = useMutation({
    mutationFn: async (form: HTMLFormElement) => {
      const data = new FormData(form);
      return (
        await api.post("/companies", {
          company_code: data.get("company_code"),
          company_name: data.get("company_name"),
          industry: data.get("industry"),
          functional_currency: data.get("functional_currency"),
          fiscal_year_start_month: Number(data.get("fiscal_year_start_month")),
          close_frequency: "MONTHLY",
          month_close_day: Number(data.get("month_close_day")),
        })
      ).data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["companies"] }),
  });
  const company = companies.data?.[0];

  return (
    <Box sx={{ maxWidth: 1720, mx: "auto", color: colors.text }}>
      <SettingsHeading tab={tab} />
      <Tabs
        value={tab}
        onChange={(_, value) => setTab(value)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          mb: 3,
          borderBottom: `1px solid ${colors.border}`,
          minHeight: 49,
          "& .MuiTabs-indicator": { height: 2, bgcolor: colors.primary },
          "& .MuiTab-root": {
            minHeight: 49,
            px: 3,
            py: 1.5,
            textTransform: "none",
            color: colors.text,
            fontSize: 14,
            fontWeight: 500,
          },
          "& .Mui-selected": {
            color: `${colors.primary} !important`,
            fontWeight: "700 !important",
            bgcolor: "transparent",
          },
        }}
      >
        <Tab
          icon={tab === 0 ? <BusinessOutlined fontSize="small" /> : undefined}
          iconPosition="start"
          label="회사 및 회계연도"
        />
        <Tab
          icon={tab === 0 ? <GavelOutlined fontSize="small" /> : undefined}
          iconPosition="start"
          label="감사 중요성"
        />
        <Tab
          icon={tab === 0 ? <AutoGraphOutlined fontSize="small" /> : undefined}
          iconPosition="start"
          label="계정 증감(AVI)"
        />
        <Tab
          icon={tab === 0 ? <PsychologyOutlined fontSize="small" /> : undefined}
          iconPosition="start"
          label="AI 및 지식베이스"
        />
      </Tabs>

      {tab === 0 && (
        <CompanySettings
          companies={companies.data ?? []}
          company={company}
          createCompany={createCompany}
        />
      )}
      {tab === 1 && <MaterialitySettings company={company} />}
      {tab === 2 && <VarianceSettings company={company} />}
      {tab === 3 && (
        <Stack spacing={2.5}>
          <AiSettings />
          <KnowledgeSettings company={company} />
        </Stack>
      )}
    </Box>
  );
}

function SettingsHeading({ tab }: { tab: number }) {
  if (tab === 0) {
    return (
      <Box sx={{ mb: 2.5 }}>
        <Typography variant="h4">설정</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          회사별 결산 분석 준비 상태와 운영 기준을 관리합니다.
        </Typography>
      </Box>
    );
  }
  if (tab === 1) {
    return (
      <Box sx={{ mb: 2.5 }}>
        <Breadcrumb current="감사 중요성" />
        <Typography variant="h4" sx={{ mt: 1 }}>
          감사 중요성 (Audit Materiality)
        </Typography>
      </Box>
    );
  }
  if (tab === 2)
    return (
      <Box sx={{ mb: 2 }}>
        <Breadcrumb middle="Audit Intelligence" current="계정 증감(AVI)" />
      </Box>
    );
  return (
    <Box sx={{ mb: 2.5 }}>
      <Breadcrumb current="AI 및 지식베이스" />
      <Typography variant="h4" sx={{ mt: 1 }}>
        AI 및 지식베이스 설정
      </Typography>
      <Typography color="text.secondary" variant="body2" sx={{ mt: 0.75 }}>
        리스크 분석 엔진을 위한 AI 엔진 연결 및 감사 지식베이스(RAG) 문서를
        관리합니다.
      </Typography>
    </Box>
  );
}

function Breadcrumb({ middle, current }: { middle?: string; current: string }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography variant="caption" color="text.secondary">
        설정
      </Typography>
      <Typography variant="caption" color="text.secondary">
        ›
      </Typography>
      {middle && (
        <>
          <Typography variant="caption" color="text.secondary">
            {middle}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            ›
          </Typography>
        </>
      )}
      <Typography variant="caption" color="primary.main" fontWeight={700}>
        {current}
      </Typography>
    </Stack>
  );
}

function SectionTitle({
  children,
  marker = false,
  icon,
}: {
  children: ReactNode;
  marker?: boolean;
  icon?: ReactNode;
}) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="center">
      {marker && (
        <Box
          sx={{
            width: 6,
            height: 20,
            bgcolor: colors.primary,
            borderRadius: 4,
          }}
        />
      )}
      {icon}
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        {children}
      </Typography>
    </Stack>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack spacing={0.75}>
      <Typography
        variant="caption"
        sx={{ fontWeight: 700, color: colors.secondary }}
      >
        {label}
      </Typography>
      {children}
    </Stack>
  );
}

function CompanySettings({
  companies,
  company,
  createCompany,
}: {
  companies: Company[];
  company?: Company;
  createCompany: CompanyMutation;
}) {
  const queryClient = useQueryClient();
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [managementError, setManagementError] = useState("");
  const updateCompany = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Record<string, unknown>;
    }) => api.patch(`/companies/${id}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["companies"] }),
  });
  const deleteCompany = useMutation({
    mutationFn: (id: string) => api.delete(`/companies/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["companies"] }),
  });
  const resetForm = () =>
    (
      document.getElementById("company-settings-form") as HTMLFormElement | null
    )?.reset();
  return (
    <Stack spacing={2.5}>
      <Card sx={cardSx}>
        <Box sx={cardHeaderSx}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <SectionTitle marker>회사 기본 정보</SectionTitle>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                onClick={resetForm}
                sx={{
                  minWidth: 72,
                  borderColor: colors.border,
                  color: colors.secondary,
                }}
              >
                초기화
              </Button>
              <Button
                type="submit"
                form="company-settings-form"
                variant="contained"
                disabled={createCompany.isPending}
                sx={{ minWidth: 72, bgcolor: colors.primary }}
              >
                저장
              </Button>
            </Stack>
          </Stack>
        </Box>
        <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
          {createCompany.isError && (
            <Alert severity="error" sx={{ mb: 2.5 }}>
              회사 정보 저장에 실패했습니다. 입력값과 연결 상태를 확인해 주세요.
            </Alert>
          )}
          <Box
            id="company-settings-form"
            component="form"
            onSubmit={(event) => {
              event.preventDefault();
              createCompany.mutate(event.currentTarget);
            }}
          >
            {company && (
              <input
                type="hidden"
                name="company_code"
                value={company.company_code}
              />
            )}
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <Field label="회사 코드">
                  <TextField
                    name="company_code"
                    defaultValue={company?.company_code ?? ""}
                    placeholder="예: ARIP01"
                    required
                    fullWidth
                    disabled={Boolean(company)}
                    sx={smallFieldSx}
                  />
                </Field>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <Field label="회사명">
                  <TextField
                    name="company_name"
                    defaultValue={company?.company_name ?? ""}
                    placeholder="예: (주)ARIP 전자"
                    required
                    fullWidth
                    sx={smallFieldSx}
                  />
                </Field>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <Field label="업종">
                  <TextField
                    name="industry"
                    select
                    defaultValue={company?.industry ?? "제조업"}
                    required
                    fullWidth
                    sx={smallFieldSx}
                  >
                    <MenuItem value="제조업">제조업</MenuItem>
                    <MenuItem value="서비스업">서비스업</MenuItem>
                    <MenuItem value="금융업">금융업</MenuItem>
                    <MenuItem value="유통업">유통업</MenuItem>
                  </TextField>
                </Field>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <Field label="기능통화">
                  <TextField
                    name="functional_currency"
                    select
                    defaultValue={company?.functional_currency ?? "KRW"}
                    required
                    fullWidth
                    sx={smallFieldSx}
                  >
                    <MenuItem value="KRW">KRW</MenuItem>
                    <MenuItem value="USD">USD</MenuItem>
                    <MenuItem value="EUR">EUR</MenuItem>
                  </TextField>
                </Field>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <Field label="표준시간대">
                  <TextField
                    select
                    defaultValue="Asia/Seoul (GMT+9)"
                    fullWidth
                    sx={smallFieldSx}
                  >
                    <MenuItem value="Asia/Seoul (GMT+9)">
                      Asia/Seoul (GMT+9)
                    </MenuItem>
                    <MenuItem value="UTC">UTC</MenuItem>
                  </TextField>
                </Field>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <Field label="회계연도 시작월">
                  <TextField
                    name="fiscal_year_start_month"
                    select
                    defaultValue={String(company?.fiscal_year_start_month ?? 1)}
                    required
                    fullWidth
                    sx={smallFieldSx}
                  >
                    {[1, 4, 7].map((month) => (
                      <MenuItem key={month} value={String(month)}>
                        {month}월
                      </MenuItem>
                    ))}
                  </TextField>
                </Field>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <Field label="월 마감일">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2">매월</Typography>
                    <TextField
                      name="month_close_day"
                      type="number"
                      defaultValue="5"
                      required
                      sx={{ ...smallFieldSx, width: 80 }}
                    />
                    <Typography variant="body2">일</Typography>
                  </Stack>
                </Field>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <Field label="적용 시작일">
                  <TextField
                    type="date"
                    defaultValue="2024-01-01"
                    fullWidth
                    sx={smallFieldSx}
                  />
                </Field>
              </Grid>
            </Grid>
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <ReadinessTile
          label="전체 등록 회사"
          value={String(companies.length)}
          icon={<CorporateFareOutlined />}
        />
        <ReadinessTile
          label="분석 가능"
          value={company ? "1" : "0"}
          tone={colors.success}
          icon={<CheckCircleOutline />}
        />
        <ReadinessTile
          label="설정 미완료"
          value="0"
          tone={colors.warning}
          icon={<WarningAmberOutlined />}
        />
        <ReadinessTile
          label="비활성"
          value="0"
          muted
          icon={<BlockOutlined />}
        />
      </Grid>

      <Card sx={cardSx}>
        <Box sx={cardHeaderSx}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ md: "center" }}
            spacing={2}
          >
            <SectionTitle marker>등록 회사 현황</SectionTitle>
            <Stack direction="row" spacing={1.5}>
              <TextField
                size="small"
                placeholder="회사명 또는 코드 검색..."
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search fontSize="small" />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{ ...smallFieldSx, width: { xs: "100%", sm: 320 } }}
              />
              <Button
                variant="outlined"
                sx={{
                  minWidth: 48,
                  p: 1,
                  borderColor: colors.border,
                  color: colors.secondary,
                }}
              >
                <Refresh />
              </Button>
            </Stack>
          </Stack>
        </Box>
        <CompanyTable
          companies={companies}
          onManage={(item) => {
            setManagementError("");
            setSelectedCompany(item);
          }}
        />
      </Card>
      <CompanyManagementDialog
        company={selectedCompany}
        error={managementError}
        saving={updateCompany.isPending}
        deleting={deleteCompany.isPending}
        deleteOpen={confirmDelete}
        onClose={() => {
          setSelectedCompany(null);
          setConfirmDelete(false);
        }}
        onRequestDelete={() => setConfirmDelete(true)}
        onCancelDelete={() => setConfirmDelete(false)}
        onSave={async (form) => {
          if (!selectedCompany) return;
          const data = new FormData(form);
          setManagementError("");
          try {
            await updateCompany.mutateAsync({
              id: selectedCompany.id,
              payload: {
                company_code: data.get("company_code"),
                company_name: data.get("company_name"),
                industry: data.get("industry"),
                functional_currency: data.get("functional_currency"),
                timezone: data.get("timezone"),
                fiscal_year_start_month: Number(
                  data.get("fiscal_year_start_month"),
                ),
                close_frequency: "MONTHLY",
                month_close_day: Number(data.get("month_close_day")),
              },
            });
            setSelectedCompany(null);
          } catch {
            setManagementError("회사 정보 저장에 실패했습니다.");
          }
        }}
        onDelete={async () => {
          if (!selectedCompany) return;
          setManagementError("");
          try {
            await deleteCompany.mutateAsync(selectedCompany.id);
            setConfirmDelete(false);
            setSelectedCompany(null);
          } catch {
            setManagementError("회사 삭제에 실패했습니다.");
          }
        }}
      />
    </Stack>
  );
}

function ReadinessTile({
  label,
  value,
  tone = colors.secondary,
  muted = false,
  icon,
}: {
  label: string;
  value: string;
  tone?: string;
  muted?: boolean;
  icon: ReactNode;
}) {
  return (
    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
      <Card sx={{ ...cardSx, opacity: muted ? 0.72 : 1 }}>
        <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Box>
              <Typography
                variant="caption"
                sx={{ fontWeight: 700, color: tone }}
              >
                {label}
              </Typography>
              <Typography sx={{ fontSize: 32, lineHeight: 1.2, mt: 0.75 }}>
                {value}
              </Typography>
            </Box>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                bgcolor: tone === colors.secondary ? "#ECEEF0" : `${tone}14`,
                color: tone,
              }}
            >
              {icon}
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Grid>
  );
}

function CompanyTable({
  companies,
  onManage,
}: {
  companies: Company[];
  onManage: (company: Company) => void;
}) {
  return (
    <TableContainer>
      <Table size="small" sx={{ minWidth: 980 }}>
        <TableHead>
          <TableRow>
            {[
              "회사 코드",
              "회사명",
              "업종",
              "통화",
              "회계연도",
              "운영 상태",
              "누락 설정",
              "최종 수정",
              "조치",
            ].map((label) => (
              <TableCell
                key={label}
                align={label === "조치" ? "right" : "left"}
              >
                {label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {companies.length ? (
            companies.map((item, index) => (
              <TableRow key={item.id} hover>
                <TableCell sx={{ color: colors.primary, fontWeight: 600 }}>
                  {item.company_code}
                </TableCell>
                <TableCell>{item.company_name}</TableCell>
                <TableCell>{item.industry}</TableCell>
                <TableCell>{item.functional_currency}</TableCell>
                <TableCell>{`${item.fiscal_year_start_month || 1}월 시작`}</TableCell>
                <TableCell>
                  <StatusChip
                    label={index === 0 ? "분석 가능" : "설정 미완료"}
                    tone={index === 0 ? "success" : "warning"}
                  />
                </TableCell>
                <TableCell sx={{ color: colors.secondary }}>
                  {index === 0 ? "-" : "중요성 기준"}
                </TableCell>
                <TableCell sx={{ color: colors.secondary }}>-</TableCell>
                <TableCell align="right">
                  <IconButton
                    aria-label="회사 정보 관리"
                    onClick={() => onManage(item)}
                    size="small"
                    sx={{ color: colors.secondary }}
                  >
                    <SettingsOutlined fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={9}
                align="center"
                sx={{ py: 5, color: colors.secondary }}
              >
                등록된 회사가 없습니다.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function CompanyManagementDialog({
  company,
  error,
  saving,
  deleting,
  deleteOpen,
  onClose,
  onRequestDelete,
  onCancelDelete,
  onSave,
  onDelete,
}: {
  company: Company | null;
  error: string;
  saving: boolean;
  deleting: boolean;
  deleteOpen: boolean;
  onClose: () => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onSave: (form: HTMLFormElement) => void;
  onDelete: () => void;
}) {
  return (
    <>
      <Dialog open={Boolean(company)} onClose={onClose} fullWidth maxWidth="sm">
        <Box
          component="form"
          onSubmit={(event) => {
            event.preventDefault();
            onSave(event.currentTarget);
          }}
        >
          <DialogTitle>회사 정보 관리</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField
                name="company_code"
                label="회사 코드"
                defaultValue={company?.company_code}
                required
                fullWidth
              />
              <TextField
                name="company_name"
                label="회사명"
                defaultValue={company?.company_name}
                required
                fullWidth
              />
              <TextField
                name="industry"
                label="업종"
                defaultValue={company?.industry}
                required
                fullWidth
              />
              <TextField
                name="functional_currency"
                label="기능통화"
                defaultValue={company?.functional_currency}
                required
                fullWidth
              />
              <TextField
                name="timezone"
                label="표준시간대"
                defaultValue={company?.timezone ?? "Asia/Seoul"}
                required
                fullWidth
              />
              <TextField
                name="fiscal_year_start_month"
                label="회계연도 시작월"
                type="number"
                defaultValue={company?.fiscal_year_start_month}
                required
                fullWidth
              />
              <TextField
                name="month_close_day"
                label="월 마감일"
                type="number"
                defaultValue={company?.month_close_day ?? 5}
                required
                fullWidth
              />
              {error && <Alert severity="error">{error}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>취소</Button>
            <Button type="submit" variant="contained" disabled={saving}>
              저장
            </Button>
          </DialogActions>
          <Box sx={{ p: 2, borderTop: `1px solid ${colors.border}` }}>
            <Button color="error" onClick={onRequestDelete}>
              회사 삭제
            </Button>
          </Box>
        </Box>
      </Dialog>
      <Dialog open={deleteOpen} onClose={onCancelDelete}>
        <DialogTitle>회사를 완전히 삭제할까요?</DialogTitle>
        <DialogContent>
          회사 정보와 관련 저장 이력은 복구할 수 없습니다.
        </DialogContent>
        <DialogActions>
          <Button onClick={onCancelDelete}>취소</Button>
          <Button
            color="error"
            variant="contained"
            onClick={onDelete}
            disabled={deleting}
          >
            완전히 삭제
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function LegacyMaterialitySettings({ company }: { company?: Company }) {
  const [message, setMessage] = useState("");
  const [overall, setOverall] = useState("500000000");
  const [performance, setPerformance] = useState("300000000");
  const [trivial, setTrivial] = useState("10000000");
  const [benchmark, setBenchmark] = useState("REVENUE");
  if (!company)
    return (
      <Alert severity="info">
        먼저 회사 및 회계연도 탭에서 회사를 등록해 주세요.
      </Alert>
    );
  const money = (value: string) =>
    value ? `${Number(value).toLocaleString("ko-KR")}원` : "입력 전";
  return (
    <Grid container spacing={3} alignItems="flex-start">
      <Grid size={{ xs: 12, lg: 8.5 }}>
        <Stack spacing={3}>
          <Card sx={cardSx}>
            <Box sx={cardHeaderSx}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                감사 중요성 기준 설정
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5 }}
              >
                감사 리스크 평가에 적용할 중요성 기준을 설정합니다.
              </Typography>
            </Box>
            <CardContent sx={{ p: 3, "&:last-child": { pb: 0 } }}>
              <Box
                id="materiality-form"
                component="form"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  await api.post("/settings/materiality", {
                    company_id: company.id,
                    name: "기본 중요성",
                    benchmark: data.get("benchmark"),
                    overall_materiality: data.get("overall"),
                    performance_materiality: data.get("performance"),
                    trivial_threshold: data.get("trivial"),
                    effective_from: data.get("effective_from"),
                    approve: true,
                  });
                  setMessage("중요성 기준이 승인된 상태로 저장되었습니다.");
                }}
              >
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Field label="기준 회사">
                      <TextField
                        value={company.company_name}
                        fullWidth
                        slotProps={{ input: { readOnly: true } }}
                        sx={fieldSx}
                      />
                    </Field>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Field label="벤치마크">
                      <TextField
                        name="benchmark"
                        select
                        value={benchmark}
                        onChange={(e) => setBenchmark(e.target.value)}
                        fullWidth
                        sx={fieldSx}
                      >
                        <MenuItem value="REVENUE">매출액</MenuItem>
                        <MenuItem value="TOTAL_ASSETS">총자산</MenuItem>
                        <MenuItem value="EQUITY">자기자본</MenuItem>
                      </TextField>
                    </Field>
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Field label="전체 중요성 (Overall Materiality)">
                      <TextField
                        name="overall"
                        type="number"
                        value={overall}
                        onChange={(e) => setOverall(e.target.value)}
                        fullWidth
                        helperText={`정규화: ${money(overall)}`}
                        sx={{
                          ...fieldSx,
                          "& .MuiFormHelperText-root": {
                            color: colors.primary,
                            fontWeight: 600,
                            mx: 0,
                            mt: 0.75,
                          },
                        }}
                      />
                    </Field>
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Field label="수행 중요성 (Performance Materiality)">
                      <TextField
                        name="performance"
                        type="number"
                        value={performance}
                        onChange={(e) => setPerformance(e.target.value)}
                        fullWidth
                        helperText="75% 기준 적용 시"
                        sx={fieldSx}
                      />
                    </Field>
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Field label="사소한 금액 기준 (SADT)">
                      <TextField
                        name="trivial"
                        type="number"
                        value={trivial}
                        onChange={(e) => setTrivial(e.target.value)}
                        fullWidth
                        helperText="전체 중요성의 2% 미만"
                        sx={fieldSx}
                      />
                    </Field>
                  </Grid>
                  <Grid size={12}>
                    <Field label="적용 기간">
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <TextField
                          name="effective_from"
                          type="date"
                          defaultValue="2024-01-01"
                          fullWidth
                          sx={fieldSx}
                        />
                        <Typography color="text.secondary">~</Typography>
                        <TextField
                          type="date"
                          defaultValue="2024-12-31"
                          fullWidth
                          sx={fieldSx}
                        />
                      </Stack>
                    </Field>
                  </Grid>
                  <Grid size={12}>
                    <Field label="정성적 고려사항 (Qualitative Considerations)">
                      <TextField
                        multiline
                        minRows={4}
                        defaultValue="전기 대비 매출액 성장률이 15% 이상으로 급격히 증가함에 따라 수익 인식의 적절성에 대한 리스크를 반영하여 전체 중요성을 보수적으로 책정함."
                        fullWidth
                        sx={fieldSx}
                      />
                    </Field>
                  </Grid>
                </Grid>
                {message && (
                  <Alert severity="success" sx={{ mt: 2 }}>
                    {message}
                  </Alert>
                )}
                <Box
                  sx={{
                    mx: -3,
                    mt: 3,
                    p: 3,
                    bgcolor: colors.soft,
                    borderTop: `1px solid ${colors.border}`,
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    sx={{ mb: 2 }}
                  >
                    <History fontSize="small" />
                    <Typography variant="body2" fontWeight={700}>
                      프로필 이력 (Version History)
                    </Typography>
                  </Stack>
                  <Stack spacing={1.5}>
                    <HistoryRow
                      version="v1.2"
                      date="2024.03.15 14:22"
                      author="김회계"
                      status="승인됨"
                    />
                    <HistoryRow
                      version="v1.1"
                      date="2024.03.10 09:15"
                      author="이감사"
                      status="초안"
                    />
                  </Stack>
                </Box>
              </Box>
            </CardContent>
          </Card>
          <AiSummary>
            입력된 중요성 기준({money(overall)})은 동종 업계 평균 범위 내에
            위치하고 있습니다. 정성적 고려사항의 수익 인식 리스크를 고려할 때,{" "}
            <Box
              component="span"
              sx={{ fontWeight: 700, color: colors.primary }}
            >
              수행 중요성 비율을 60% 이하
            </Box>
            로 조정하는 것을 검토하십시오. 최종 결정은 감사인의 판단이
            필요합니다.
          </AiSummary>
        </Stack>
      </Grid>
      <Grid size={{ xs: 12, lg: 3.5 }}>
        <Card sx={{ ...cardSx, position: { lg: "sticky" }, top: { lg: 88 } }}>
          <Box sx={cardHeaderSx}>
            <SectionTitle
              icon={<VisibilityOutlined sx={{ color: colors.primary }} />}
            >
              저장 전 미리보기
            </SectionTitle>
          </Box>
          <CardContent sx={{ p: 3 }}>
            <Stack spacing={2.25}>
              <PreviewFact label="전체 중요성" value={money(overall)} />
              <PreviewFact label="수행 중요성" value={money(performance)} />
              <PreviewFact label="사소한 금액" value={money(trivial)} />
              <PreviewFact
                label="벤치마크"
                value={
                  benchmark === "REVENUE"
                    ? "매출액"
                    : benchmark === "TOTAL_ASSETS"
                      ? "총자산"
                      : "자기자본"
                }
              />
              <Alert
                severity="info"
                icon={<InfoOutlined />}
                sx={{
                  bgcolor: "#E6F0FA",
                  color: colors.primary,
                  "& .MuiAlert-message": { fontSize: 12 },
                }}
              >
                저장 시 입력 표현과 정규화된 원화 금액이 함께 기록됩니다. 감사
                증적용 보고서에 자동 반영됩니다.
              </Alert>
            </Stack>
          </CardContent>
          <Box sx={{ p: 3, borderTop: `1px solid ${colors.border}` }}>
            <Stack spacing={1.5}>
              <Button
                variant="outlined"
                fullWidth
                sx={{ borderColor: colors.border, color: colors.text }}
              >
                임시 저장
              </Button>
              <Button
                type="submit"
                form="materiality-form"
                variant="contained"
                fullWidth
                sx={{ bgcolor: colors.primary }}
              >
                검토 후 저장
              </Button>
            </Stack>
          </Box>
        </Card>
      </Grid>
    </Grid>
  );
}

type CurrentMateriality = {
  id: string;
  company_id: string;
  benchmark: string;
  overall_materiality: string | number;
  performance_materiality: string | number;
  trivial_threshold: string | number;
  effective_from: string;
  status: string;
};

function MaterialitySettings({ company }: { company?: Company }) {
  const [overall, setOverall] = useState("500000000");
  const [performance, setPerformance] = useState("300000000");
  const [trivial, setTrivial] = useState("10000000");
  const [benchmark, setBenchmark] = useState("REVENUE");
  const [effectiveFrom, setEffectiveFrom] = useState("2024-01-01");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const materiality = useQuery({
    queryKey: ["materiality", company?.id],
    enabled: Boolean(company),
    queryFn: async () =>
      (
        await api.get<CurrentMateriality | null>("/settings/materiality", {
          params: { company_id: company!.id },
        })
      ).data,
  });

  useEffect(() => {
    if (!materiality.data) return;
    setBenchmark(materiality.data.benchmark);
    setOverall(String(materiality.data.overall_materiality));
    setPerformance(String(materiality.data.performance_materiality));
    setTrivial(String(materiality.data.trivial_threshold));
    setEffectiveFrom(materiality.data.effective_from);
  }, [materiality.data]);

  if (!company) {
    return <Alert severity="info">먼저 회사 및 회계연도 탭에서 회사를 등록해 주세요.</Alert>;
  }

  const money = (value: string | number) => `${Number(value).toLocaleString("ko-KR")}원`;
  const saved = materiality.data;
  const benchmarkLabel = (value: string) =>
    value === "REVENUE" ? "매출액" : value === "TOTAL_ASSETS" ? "총자산" : "자기자본";

  return (
    <Grid container spacing={3} alignItems="flex-start">
      <Grid size={{ xs: 12, lg: 8.5 }}>
        <Card sx={cardSx}>
          <Box sx={cardHeaderSx}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>감사 중요성 기준 설정</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              회사별 현재 적용 중요성 기준을 관리합니다.
            </Typography>
          </Box>
          <CardContent sx={{ p: 3 }}>
            <Box
              id="materiality-form"
              component="form"
              onSubmit={async (event) => {
                event.preventDefault();
                setMessage("");
                setError("");
                try {
                  await api.put(`/settings/materiality/${company.id}`, {
                    company_id: company.id,
                    name: "기본 중요성",
                    benchmark,
                    overall_materiality: overall,
                    performance_materiality: performance,
                    trivial_threshold: trivial,
                    effective_from: effectiveFrom,
                    approve: true,
                  });
                  await materiality.refetch();
                  setMessage("현재 적용 중요성 기준을 저장했습니다.");
                } catch {
                  setError("중요성 기준 저장에 실패했습니다. 입력값과 연결 상태를 확인해 주세요.");
                }
              }}
            >
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 6 }}><Field label="회사명"><TextField value={company.company_name} fullWidth slotProps={{ input: { readOnly: true } }} sx={fieldSx} /></Field></Grid>
                <Grid size={{ xs: 12, md: 6 }}><Field label="회계연도"><TextField value={`${company.fiscal_year_start_month}월 시작`} fullWidth slotProps={{ input: { readOnly: true } }} sx={fieldSx} /></Field></Grid>
                <Grid size={{ xs: 12, md: 6 }}><Field label="벤치마크"><TextField select value={benchmark} onChange={(event) => setBenchmark(event.target.value)} fullWidth sx={fieldSx}><MenuItem value="REVENUE">매출액</MenuItem><MenuItem value="TOTAL_ASSETS">총자산</MenuItem><MenuItem value="EQUITY">자기자본</MenuItem></TextField></Field></Grid>
                <Grid size={{ xs: 12, md: 6 }}><Field label="적용 시작일"><TextField type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} fullWidth sx={fieldSx} /></Field></Grid>
                <Grid size={{ xs: 12, md: 4 }}><Field label="전체 중요성"><TextField type="number" value={overall} onChange={(event) => setOverall(event.target.value)} fullWidth sx={fieldSx} /></Field></Grid>
                <Grid size={{ xs: 12, md: 4 }}><Field label="수행 중요성"><TextField type="number" value={performance} onChange={(event) => setPerformance(event.target.value)} fullWidth sx={fieldSx} /></Field></Grid>
                <Grid size={{ xs: 12, md: 4 }}><Field label="사소한 금액"><TextField type="number" value={trivial} onChange={(event) => setTrivial(event.target.value)} fullWidth sx={fieldSx} /></Field></Grid>
              </Grid>
              {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
              {message && <Alert severity="success" sx={{ mt: 2 }}>{message}</Alert>}
            </Box>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, lg: 3.5 }}>
        <Card sx={{ ...cardSx, position: { lg: "sticky" }, top: { lg: 88 } }}>
          <Box sx={cardHeaderSx}><SectionTitle icon={<VisibilityOutlined sx={{ color: colors.primary }} />}>저장 결과</SectionTitle></Box>
          <CardContent sx={{ p: 3 }}>
            {materiality.isLoading ? <Typography color="text.secondary">저장된 기준을 불러오는 중입니다.</Typography> : saved ? <Stack spacing={1.5}>
              <PreviewFact label="회사" value={`${company.company_name} (${company.company_code})`} />
              <PreviewFact label="회계연도" value={`${company.fiscal_year_start_month}월 시작`} />
              <PreviewFact label="전체 중요성" value={money(saved.overall_materiality)} />
              <PreviewFact label="수행 중요성" value={money(saved.performance_materiality)} />
              <PreviewFact label="사소한 금액" value={money(saved.trivial_threshold)} />
              <PreviewFact label="벤치마크" value={benchmarkLabel(saved.benchmark)} />
              <PreviewFact label="적용 시작일" value={saved.effective_from} />
            </Stack> : <Typography color="text.secondary">저장된 현재 적용 중요성 기준이 없습니다.</Typography>}
          </CardContent>
          <Box sx={{ p: 3, borderTop: `1px solid ${colors.border}` }}><Button type="submit" form="materiality-form" variant="contained" fullWidth sx={{ bgcolor: colors.primary }}>검토 후 저장</Button></Box>
        </Card>
      </Grid>
    </Grid>
  );
}

function HistoryRow({
  version,
  date,
  author,
  status,
}: {
  version: string;
  date: string;
  author: string;
  status: string;
}) {
  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      sx={{
        p: 1.5,
        bgcolor: "#FFF",
        border: `1px solid ${colors.border}`,
        borderRadius: 1,
      }}
    >
      <Stack direction="row" spacing={2}>
        <Typography variant="body2" fontWeight={700}>
          {version}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {date}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          작성자: {author}
        </Typography>
      </Stack>
      <Chip
        label={status}
        size="small"
        sx={{
          bgcolor: status === "승인됨" ? "#E9F8EF" : "#E0E3E5",
          color: status === "승인됨" ? colors.success : colors.secondary,
          fontWeight: 700,
        }}
      />
    </Stack>
  );
}

function VarianceSettings({ company }: { company?: Company }) {
  const [message, setMessage] = useState("");
  const [comparison, setComparison] = useState<"MOM" | "YOY">("MOM");
  const [mode, setMode] = useState<"ANY" | "ALL">("ANY");
  if (!company)
    return (
      <Alert severity="info">
        먼저 회사 및 회계연도 탭에서 회사를 등록해 주세요.
      </Alert>
    );
  return (
    <Stack spacing={3}>
      <Alert
        severity="info"
        icon={<InfoOutlined />}
        sx={{
          border: "1px solid #BFDBFE",
          bgcolor: "#F0F7FF",
          color: colors.primary,
          fontWeight: 600,
        }}
      >
        AVI 관측치는 증감 원인을 확인하기 위한 정량 신호입니다. 담당자가
        명시적으로 연결하기 전에는 Audit Risk로 자동 생성되지 않습니다.
      </Alert>
      <Grid container spacing={3} alignItems="stretch">
        <Grid size={{ xs: 12, lg: 5 }}>
          <Card sx={{ ...cardSx, height: "100%" }}>
            <CardContent sx={{ p: 3 }}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mb: 3 }}
              >
                <Typography variant="h6" fontWeight={700}>
                  계정 증감 기준 (AVI)
                </Typography>
                <HelpOutline sx={{ color: colors.secondary }} />
              </Stack>
              <Box
                component="form"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  const common = {
                    amount_threshold: data.get("amount"),
                    rate_threshold: Number(data.get("rate")) / 100,
                    minimum_base_amount: data.get("minimum"),
                    trigger_mode: data.get("mode"),
                  };
                  await api.post("/variance-settings/profiles", {
                    company_id: company.id,
                    name: "기본 AVI",
                    approve: true,
                    thresholds: [
                      { comparison: "MOM", ...common },
                      { comparison: "YOY", ...common },
                    ],
                  });
                  setMessage("AVI 기준이 승인된 상태로 저장되었습니다.");
                }}
              >
                <Grid container spacing={2.5}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Field label="기준 회사">
                      <TextField
                        value={company.company_name}
                        fullWidth
                        slotProps={{ input: { readOnly: true } }}
                        sx={smallFieldSx}
                      />
                    </Field>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Field label="적용 기간">
                      <TextField
                        value="2023.01.01 ~ 2023.12.31"
                        fullWidth
                        slotProps={{ input: { readOnly: true } }}
                        sx={smallFieldSx}
                      />
                    </Field>
                  </Grid>
                  <Grid size={12}>
                    <Field label="Comparison Type">
                      <Segmented
                        value={comparison}
                        onChange={(value) =>
                          setComparison(value as "MOM" | "YOY")
                        }
                        options={[
                          ["MOM", "MoM (전월 대비)"],
                          ["YOY", "YoY (전년 동기 대비)"],
                        ]}
                      />
                    </Field>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Field label="증감 금액 기준">
                      <TextField
                        name="amount"
                        type="number"
                        defaultValue="500000000"
                        fullWidth
                        slotProps={{
                          input: {
                            endAdornment: (
                              <InputAdornment position="end">
                                KRW
                              </InputAdornment>
                            ),
                          },
                        }}
                        sx={smallFieldSx}
                      />
                    </Field>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Field label="증감률 기준">
                      <TextField
                        name="rate"
                        type="number"
                        defaultValue="20"
                        fullWidth
                        slotProps={{
                          input: {
                            endAdornment: (
                              <InputAdornment position="end">%</InputAdornment>
                            ),
                          },
                        }}
                        sx={smallFieldSx}
                      />
                    </Field>
                  </Grid>
                  <Grid size={12}>
                    <Field label="최소 비교 금액 (Noise Reduction)">
                      <TextField
                        name="minimum"
                        type="number"
                        defaultValue="100000000"
                        fullWidth
                        helperText="해당 금액 미만의 잔액을 가진 계정은 분석 대상에서 제외합니다."
                        slotProps={{
                          input: {
                            endAdornment: (
                              <InputAdornment position="end">
                                KRW
                              </InputAdornment>
                            ),
                          },
                        }}
                        sx={smallFieldSx}
                      />
                    </Field>
                  </Grid>
                  <Grid size={12}>
                    <Field label="Trigger Mode">
                      <input type="hidden" name="mode" value={mode} />
                      <Segmented
                        value={mode}
                        onChange={(value) => setMode(value as "ANY" | "ALL")}
                        options={[
                          ["ANY", "하나 이상 충족 (OR)"],
                          ["ALL", "모두 충족 (AND)"],
                        ]}
                      />
                    </Field>
                  </Grid>
                  <Grid size={12}>
                    <Field label="Measurement Basis">
                      <RadioGroup row defaultValue="closing">
                        <FormControlLabel
                          value="closing"
                          control={<Radio size="small" />}
                          label="기말 잔액 (Closing Balance)"
                        />
                        <FormControlLabel
                          value="flow"
                          control={<Radio size="small" />}
                          label="월간 흐름 (Net Monthly Flow)"
                        />
                      </RadioGroup>
                    </Field>
                  </Grid>
                  <Grid size={12}>
                    <Field label="변경 사유">
                      <TextField
                        multiline
                        minRows={3}
                        placeholder="기준 변경 사유를 입력하세요 (감사 대응용 기록)"
                        fullWidth
                        sx={smallFieldSx}
                      />
                    </Field>
                  </Grid>
                </Grid>
                {message && (
                  <Alert severity="success" sx={{ mt: 2 }}>
                    {message}
                  </Alert>
                )}
                <Stack
                  direction="row"
                  justifyContent="flex-end"
                  spacing={1.5}
                  sx={{ mt: 2.5 }}
                >
                  <Button
                    type="reset"
                    variant="outlined"
                    sx={{ borderColor: colors.border, color: colors.text }}
                  >
                    취소
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    sx={{ bgcolor: colors.primary }}
                  >
                    설정 적용
                  </Button>
                </Stack>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Stack spacing={3} sx={{ height: "100%" }}>
            <ExceptionTable />
            <SimulationPreview />
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: `repeat(${options.length}, 1fr)`,
        bgcolor: "#E6E8EA",
        borderRadius: 1,
        p: 0.25,
      }}
    >
      {options.map(([option, label]) => (
        <Button
          key={option}
          onClick={() => onChange(option)}
          sx={{
            minHeight: 38,
            color: value === option ? colors.primary : colors.text,
            bgcolor: value === option ? "#FFF" : "transparent",
            boxShadow:
              value === option ? "0 1px 3px rgba(16,24,40,.12)" : "none",
            "&:hover": {
              bgcolor: value === option ? "#FFF" : "rgba(255,255,255,.35)",
            },
          }}
        >
          {label}
        </Button>
      ))}
    </Box>
  );
}

function ExceptionTable() {
  const rows = [
    {
      account: "매출",
      group: "수익 계정군",
      basis: "YoY",
      amount: "↑ 10억",
      rate: "↑ 10%",
      reason: "계절성 반영",
      action: "샘플링 제외",
      tone: colors.error,
    },
    {
      account: "재고자산",
      group: "자산 계정군",
      basis: "MoM",
      amount: "↑ 3억",
      rate: "↑ 15%",
      reason: "단가 변동성",
      action: "정밀 모니터링",
      tone: colors.warning,
    },
  ];
  return (
    <Card sx={{ ...cardSx, flex: 1 }}>
      <Box sx={cardHeaderSx}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Box>
            <Typography variant="h6" fontWeight={700}>
              계정별 예외 기준
            </Typography>
            <Typography variant="caption" color="text.secondary">
              특수 계정에 대해 글로벌 기준 대신 개별 증감 임계치를 적용합니다.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<Add />}
            sx={{ borderColor: colors.primary, color: colors.primary }}
          >
            예외 기준 추가
          </Button>
        </Stack>
      </Box>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              {[
                "계정/분류",
                "비교 기준",
                "증감 금액",
                "증감률",
                "사유/조치",
                "",
              ].map((item) => (
                <TableCell key={item}>{item}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.account}>
                <TableCell>
                  <Typography variant="body2" fontWeight={700}>
                    {row.account}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {row.group}
                  </Typography>
                </TableCell>
                <TableCell>{row.basis}</TableCell>
                <TableCell sx={{ color: row.tone, fontWeight: 600 }}>
                  {row.amount}
                </TableCell>
                <TableCell sx={{ color: row.tone, fontWeight: 600 }}>
                  {row.rate}
                </TableCell>
                <TableCell>
                  <Typography
                    variant="caption"
                    display="block"
                    fontWeight={600}
                  >
                    {row.reason}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {row.action}
                  </Typography>
                </TableCell>
                <TableCell>
                  <EditOutlined
                    fontSize="small"
                    sx={{ color: colors.secondary }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
}

function SimulationPreview() {
  const rows = [
    {
      name: "미지급금",
      amount: "+12.4억",
      rate: "▲ 42%",
      description: "직전 월 대비 급격한 부채 증가 관측",
      tone: colors.error,
    },
    {
      name: "선급금",
      amount: "+8.1억",
      rate: "▲ 28%",
      description: "신규 계약 기반 대규모 선지급금 발생",
      tone: colors.error,
    },
    {
      name: "연구개발비",
      amount: "-5.5억",
      rate: "▼ 21%",
      description: "프로젝트 종료에 따른 비용 정체",
      tone: colors.success,
    },
  ];
  return (
    <Card sx={cardSx}>
      <CardContent sx={{ p: 2.5 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ mb: 2.5 }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6" fontWeight={700}>
              적용 결과 미리보기
            </Typography>
            <Chip
              label="CURRENT RULE SIMULATION"
              size="small"
              sx={{
                bgcolor: colors.primarySoft,
                color: colors.primary,
                fontSize: 10,
                fontWeight: 700,
              }}
            />
          </Stack>
          <Button size="small">상세 결과 보기</Button>
        </Stack>
        <Grid container spacing={2}>
          {rows.map((item) => (
            <Grid key={item.name} size={{ xs: 12, md: 4 }}>
              <Box
                sx={{
                  p: 2,
                  bgcolor: colors.canvas,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 1,
                }}
              >
                <Stack direction="row" justifyContent="space-between">
                  <Typography
                    variant="caption"
                    fontWeight={700}
                    color="text.secondary"
                  >
                    {item.name}
                  </Typography>
                  <Chip
                    label="AVI 정탐"
                    size="small"
                    sx={{ height: 20, fontSize: 10 }}
                  />
                </Stack>
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="baseline"
                  sx={{ mt: 1.25 }}
                >
                  <Typography sx={{ fontSize: 22, fontWeight: 700 }}>
                    {item.amount}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: item.tone, fontWeight: 600 }}
                  >
                    {item.rate}
                  </Typography>
                </Stack>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                  sx={{ minHeight: 38, mt: 0.5 }}
                >
                  {item.description}
                </Typography>
                <Chip
                  icon={<VisibilityOffOutlined />}
                  label="Audit Risk 자동 생성 안 함"
                  size="small"
                  sx={{
                    mt: 1.5,
                    bgcolor: "#ECEEF0",
                    color: colors.secondary,
                    fontSize: 10,
                  }}
                />
              </Box>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
}

function AiSettings() {
  const [saved, setSaved] = useState(false);
  return (
    <Card sx={cardSx}>
      <Box sx={{ ...cardHeaderSx, bgcolor: "#FAFBFC" }}>
        <SectionTitle
          icon={<PsychologyOutlined sx={{ color: colors.secondary }} />}
        >
          AI 연결 설정{" "}
          <Chip
            icon={<LockOutlined />}
            label="시스템 관리자 전용"
            size="small"
            sx={{ ml: 1, height: 22 }}
          />
        </SectionTitle>
      </Box>
      <CardContent sx={{ p: 3 }}>
        <Alert
          severity="info"
          icon={<InfoOutlined />}
          sx={{
            mb: 3,
            bgcolor: "#F1F6FC",
            color: colors.text,
            border: "1px solid #D9E7F5",
          }}
        >
          OpenAI 연결이 없더라도 기존에 정의된 <b>규칙(Rule)</b> 및{" "}
          <b>템플릿</b> 기반의 분석은 정상적으로 실행됩니다. AI 기능을
          활성화하면 자연어 보고서 생성 및 의미론적 문서 검색이 가능해집니다.
        </Alert>
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, lg: 8 }}>
            <Box
              component="form"
              onSubmit={async (event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                await api.patch("/settings/ai-connection", {
                  provider: "openai",
                  chat_model: data.get("model"),
                  embedding_model: "text-embedding-3-large",
                  secret_reference: data.get("secret_reference"),
                  enabled: data.get("enabled") === "true",
                });
                setSaved(true);
                event.currentTarget.reset();
              }}
            >
              <Grid container spacing={2.5}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Field label="PROVIDER">
                    <TextField
                      value="OpenAI"
                      fullWidth
                      slotProps={{ input: { readOnly: true } }}
                      sx={fieldSx}
                    />
                  </Field>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Field label="CHAT MODEL">
                    <TextField
                      name="model"
                      select
                      defaultValue="gpt-4o-mini"
                      fullWidth
                      sx={fieldSx}
                    >
                      <MenuItem value="gpt-4o-mini">gpt-4o-mini</MenuItem>
                      <MenuItem value="gpt-4o">gpt-4o</MenuItem>
                    </TextField>
                  </Field>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Field label="EMBEDDING MODEL">
                    <TextField
                      value="text-embedding-3-large"
                      fullWidth
                      slotProps={{ input: { readOnly: true } }}
                      sx={fieldSx}
                    />
                  </Field>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Field label="OPENAI API KEY">
                    <TextField
                      name="secret_reference"
                      type="password"
                      autoComplete="new-password"
                      placeholder="새 API 키 입력"
                      fullWidth
                      helperText="보안을 위해 입력 시에만 노출되며 저장 후에는 다시 표시하지 않습니다."
                      sx={fieldSx}
                    />
                  </Field>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Field label="AI 기능 상태">
                    <TextField
                      name="enabled"
                      select
                      defaultValue="false"
                      fullWidth
                      sx={fieldSx}
                    >
                      <MenuItem value="false">비활성</MenuItem>
                      <MenuItem value="true">활성</MenuItem>
                    </TextField>
                  </Field>
                </Grid>
              </Grid>
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${colors.border}` }}
              >
                <Button
                  type="button"
                  variant="outlined"
                  startIcon={<CableOutlined />}
                  sx={{ borderColor: colors.border, color: colors.primary }}
                >
                  연결 테스트
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<SaveOutlined />}
                  sx={{ bgcolor: colors.primary }}
                >
                  저장
                </Button>
              </Stack>
              {saved && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  비밀값을 노출하지 않고 연결 설정을 저장했습니다.
                </Alert>
              )}
            </Box>
          </Grid>
          <Grid size={{ xs: 12, lg: 4 }}>
            <Box
              sx={{
                p: 3,
                bgcolor: colors.canvas,
                border: `1px solid ${colors.border}`,
                borderRadius: "12px",
                height: "100%",
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                fontWeight={700}
              >
                연결 상태
              </Typography>
              <Stack
                direction="row"
                spacing={1.5}
                alignItems="center"
                sx={{ mt: 2 }}
              >
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    bgcolor: "#E7F7ED",
                    color: colors.success,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <CheckCircleOutline />
                </Box>
                <Box>
                  <Stack direction="row" spacing={1}>
                    <Typography variant="body2" fontWeight={700}>
                      API 키 미설정
                    </Typography>
                    <Chip label="검증 전" size="small" />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    저장 후에도 비밀값은 표시되지 않습니다.
                  </Typography>
                </Box>
              </Stack>
              <Stack spacing={1.5} sx={{ mt: 3 }}>
                <PreviewFact label="분당 토큰 한도(TPM)" value="200,000" />
                <PreviewFact label="분당 요청 한도(RPM)" value="500" />
              </Stack>
              <Stack
                direction="row"
                spacing={1}
                sx={{ mt: 3, pt: 2, borderTop: `1px solid ${colors.border}` }}
              >
                <ShieldOutlined
                  fontSize="small"
                  sx={{ color: colors.secondary }}
                />
                <Typography variant="caption" color="text.secondary">
                  모든 AI 통신은 암호화되며 API 사용 로그는 내부 보안 지침에
                  따라 기록됩니다.
                </Typography>
              </Stack>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}

function KnowledgeSettings({ company }: { company?: Company }) {
  const [rootDirectory, setRootDirectory] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const runtime = useQuery({
    queryKey: ["runtime-settings-v2"],
    queryFn: async () => (await api.get("/settings/runtime")).data,
  });
  useEffect(() => {
    const source = runtime.data?.knowledgeSources?.find(
      (item: { company_id?: string }) => item.company_id === company?.id,
    );
    if (source?.root_directory) setRootDirectory(String(source.root_directory));
  }, [runtime.data, company?.id]);
  if (!company)
    return (
      <Alert severity="info">
        먼저 회사 및 회계연도 탭에서 회사를 등록해 주세요.
      </Alert>
    );
  const savePath = async () => {
    setError("");
    setMessage("");
    try {
      const response = await api.patch(
        "/settings/knowledge-sources/local-standards",
        { company_id: company.id, root_directory: rootDirectory },
      );
      setRootDirectory(response.data.root_directory);
      setMessage("경로가 저장되었습니다.");
      await runtime.refetch();
    } catch {
      setError("경로 저장에 실패했습니다. 백엔드 연결과 권한을 확인해 주세요.");
    }
  };
  const uploadFiles = async () => {
    if (!selectedFiles?.length) return;
    setError("");
    setMessage("");
    try {
      const form = new FormData();
      Array.from(selectedFiles).forEach((file) => form.append("files", file));
      const response = await api.post(
        "/settings/knowledge-sources/local-standards/upload",
        form,
        { params: { company_id: company.id } },
      );
      setMessage(
        `${response.data.uploaded}개 파일을 업로드하고 확인 대기(PENDING)로 등록했습니다.`,
      );
    } catch {
      setError("파일 업로드에 실패했습니다. 백엔드 로그를 확인해 주세요.");
    }
  };
  const scanFolder = async () => {
    setError("");
    setMessage("");
    try {
      const response = await api.post(
        "/settings/knowledge-sources/local-standards/scan",
        null,
        { params: { company_id: company.id } },
      );
      setMessage(
        `${response.data.scanned}개 파일을 확인 대기(PENDING)로 등록했습니다.`,
      );
    } catch {
      setError(
        "폴더 스캔에 실패했습니다. Windows 경로는 Docker에서 직접 스캔할 수 없으므로 파일 업로드를 사용해 주세요.",
      );
    }
  };
  return (
    <>
      <Card sx={cardSx}>
        <Box sx={{ ...cardHeaderSx, bgcolor: "#FAFBFC" }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <SectionTitle
              icon={<LibraryBooksOutlined sx={{ color: colors.secondary }} />}
            >
              기준서 및 지식베이스
            </SectionTitle>
            <Button startIcon={<TuneOutlined />}>임베딩 설정</Button>
          </Stack>
        </Box>
        <CardContent sx={{ p: 3 }}>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <KnowledgeKpi label="승인됨" value="18" suffix="↑ 2" />
            <KnowledgeKpi
              label="승인 대기"
              value="4"
              suffix="건"
              tone={colors.warning}
            />
            <KnowledgeKpi
              label="RAG 사용 가능"
              value="18"
              suffix="정상 작동 중"
              tone={colors.primary}
              selected
            />
          </Grid>
          <Box
            sx={{
              p: { xs: 3, sm: 5 },
              border: `2px dashed ${colors.border}`,
              borderRadius: "12px",
              bgcolor: "#FBFCFD",
              textAlign: "center",
            }}
          >
            <Box
              sx={{
                width: 64,
                height: 64,
                mx: "auto",
                borderRadius: "50%",
                bgcolor: "#FFF",
                border: `1px solid ${colors.border}`,
                display: "grid",
                placeItems: "center",
                color: colors.primary,
              }}
            >
              <CloudUploadOutlined sx={{ fontSize: 32 }} />
            </Box>
            <Typography variant="body2" fontWeight={700} sx={{ mt: 2 }}>
              지식베이스 문서 업로드
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              sx={{ mt: 1 }}
            >
              PDF, HWP, HWPX, DOCX, TXT, MD, HTML 형식의 문서를 선택하세요.
              <br />
              (한번에 최대 10개 파일)
            </Typography>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="center"
              spacing={1.5}
              sx={{ mt: 2.5 }}
            >
              <Button
                component="label"
                variant="outlined"
                sx={{ borderColor: colors.border, color: colors.text }}
              >
                <input
                  type="file"
                  hidden
                  multiple
                  accept=".pdf,.hwp,.hwpx,.docx,.txt,.md,.html"
                  onChange={(event) => setSelectedFiles(event.target.files)}
                />
                파일 선택
              </Button>
              <Button
                variant="contained"
                disabled={!selectedFiles?.length}
                onClick={uploadFiles}
              >
                업로드
                {selectedFiles?.length ? ` (${selectedFiles.length})` : ""}
              </Button>
            </Stack>
          </Box>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            sx={{ mt: 2.5 }}
          >
            <TextField
              value={rootDirectory}
              onChange={(event) => setRootDirectory(event.target.value)}
              placeholder="컨테이너 내부 기준서 폴더 (선택) · 예: /app/data/standards"
              fullWidth
              sx={smallFieldSx}
            />
            <Button
              variant="outlined"
              disabled={!rootDirectory.trim()}
              onClick={savePath}
            >
              경로 저장
            </Button>
            <Button
              variant="outlined"
              disabled={!rootDirectory.trim()}
              onClick={scanFolder}
            >
              폴더 스캔
            </Button>
          </Stack>
          {message && (
            <Alert severity="success" sx={{ mt: 2 }}>
              {message}
            </Alert>
          )}
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
          <KnowledgeTable />
        </CardContent>
      </Card>
      <AiSummary footer>
        현재 등록된 지식베이스 문서는 총 22건으로, <b>회계기준서(12건)</b>가
        가장 높은 비중을 차지하고 있습니다. 최근 업데이트된 ‘개발비 회계정책’은
        RAG 인덱싱 대기 상태이며, 승인 후 실시간 리스크 탐지에 활용될
        예정입니다.
      </AiSummary>
    </>
  );
}

function KnowledgeKpi({
  label,
  value,
  suffix,
  tone = colors.text,
  selected = false,
}: {
  label: string;
  value: string;
  suffix: string;
  tone?: string;
  selected?: boolean;
}) {
  return (
    <Grid size={{ xs: 12, sm: 4 }}>
      <Box
        sx={{
          p: 2.5,
          border: `1px solid ${selected ? "#BFD6EF" : colors.border}`,
          borderRadius: "12px",
          bgcolor: selected ? "#F1F6FC" : colors.canvas,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: selected ? colors.primary : colors.secondary,
            fontWeight: 700,
          }}
        >
          {label}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="baseline">
          <Typography
            sx={{
              fontSize: 36,
              lineHeight: 1.25,
              fontWeight: 700,
              color: tone,
            }}
          >
            {value}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: selected ? colors.primary : colors.secondary }}
          >
            {suffix}
          </Typography>
        </Stack>
      </Box>
    </Grid>
  );
}

function KnowledgeTable() {
  const rows = [
    {
      icon: <PictureAsPdfOutlined />,
      name: "K-IFRS 제1038호 무형자산.pdf",
      type: "회계기준서",
      date: "2024.03.12",
      version: "v1.2",
      status: "승인됨",
      rag: true,
    },
    {
      icon: <LibraryBooksOutlined />,
      name: "개발비 회계정책 (내부운영지침).hwp",
      type: "내부규정",
      date: "2024.05.15",
      version: "v1.0",
      status: "승인 대기",
      rag: false,
    },
    {
      icon: <PictureAsPdfOutlined />,
      name: "2024년 결산 가이드라인_final.pdf",
      type: "가이드라인",
      date: "2024.04.02",
      version: "v2.1",
      status: "승인됨",
      rag: true,
    },
  ];
  return (
    <Box sx={{ mt: 3.5 }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 1.5 }}
      >
        <Typography variant="body2" fontWeight={700}>
          전체 문서 목록{" "}
          <Box
            component="span"
            sx={{ color: colors.primary, fontWeight: 400, ml: 0.5 }}
          >
            22
          </Box>
        </Typography>
        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            placeholder="문서 검색..."
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
            sx={smallFieldSx}
          />
          <Button
            variant="outlined"
            sx={{ minWidth: 42, p: 1, borderColor: colors.border }}
          >
            <FilterList />
          </Button>
        </Stack>
      </Stack>
      <TableContainer
        sx={{ border: `1px solid ${colors.border}`, borderRadius: "12px" }}
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              {[
                "문서명",
                "유형",
                "업로드일",
                "버전",
                "상태",
                "RAG 사용",
                "조치",
              ].map((item) => (
                <TableCell
                  key={item}
                  align={
                    ["버전", "상태", "RAG 사용", "조치"].includes(item)
                      ? "center"
                      : "left"
                  }
                >
                  {item}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.name}>
                <TableCell>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box
                      sx={{
                        color: row.name.endsWith(".pdf")
                          ? colors.error
                          : colors.primary,
                      }}
                    >
                      {row.icon}
                    </Box>
                    <Typography variant="body2" fontWeight={700}>
                      {row.name}
                    </Typography>
                  </Stack>
                </TableCell>
                <TableCell sx={{ color: colors.secondary }}>
                  {row.type}
                </TableCell>
                <TableCell sx={{ color: colors.secondary }}>
                  {row.date}
                </TableCell>
                <TableCell align="center" sx={{ color: colors.secondary }}>
                  {row.version}
                </TableCell>
                <TableCell align="center">
                  <StatusChip
                    label={row.status}
                    tone={row.status === "승인됨" ? "success" : "warning"}
                  />
                </TableCell>
                <TableCell align="center">
                  {row.rag ? (
                    <CheckCircle sx={{ color: colors.success }} />
                  ) : (
                    <PendingOutlined sx={{ color: "#C2C6D5" }} />
                  )}
                </TableCell>
                <TableCell align="center">
                  <MoreVert sx={{ color: colors.secondary }} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: "success" | "warning";
}) {
  const color = tone === "success" ? colors.success : colors.warning;
  return (
    <Chip
      label={label}
      size="small"
      sx={{
        height: 24,
        bgcolor: `${color}12`,
        color,
        fontSize: 11,
        fontWeight: 700,
        "&:before": {
          content: '""',
          width: 5,
          height: 5,
          bgcolor: color,
          borderRadius: "50%",
          ml: 1,
        },
      }}
    />
  );
}

function PreviewFact({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={700}>
        {value}
      </Typography>
    </Stack>
  );
}

function AiSummary({
  children,
  footer = false,
}: {
  children: ReactNode;
  footer?: boolean;
}) {
  return (
    <Box
      sx={{
        p: 3,
        bgcolor: "#F3F7FC",
        border: "1px solid #C7DCF2",
        borderRadius: "12px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1,
            bgcolor: "#E2EDF8",
            color: colors.primary,
            display: "grid",
            placeItems: "center",
            flex: "0 0 auto",
          }}
        >
          <AutoAwesome />
        </Box>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" fontWeight={700} color="primary.main">
              AI 분석 요약
            </Typography>
            <Chip
              label={footer ? "ENGINE BETA" : "BETA"}
              size="small"
              sx={{
                height: 20,
                color: colors.primary,
                bgcolor: "#DDEBFA",
                fontSize: 9,
                fontWeight: 700,
              }}
            />
          </Stack>
          <Typography variant="body2" sx={{ mt: 1, lineHeight: 1.8 }}>
            {children}
          </Typography>
          {footer && (
            <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                최근 생성 · 사람의 검토가 필요합니다.
              </Typography>
            </Stack>
          )}
        </Box>
      </Stack>
    </Box>
  );
}
