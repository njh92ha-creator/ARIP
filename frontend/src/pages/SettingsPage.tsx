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
  BlockOutlined,
  BusinessOutlined,
  CableOutlined,
  CheckCircle,
  CheckCircleOutline,
  CloudUploadOutlined,
  CorporateFareOutlined,
  DeleteOutline,
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
import { api, Company, Risk } from "../api";

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
          icon={tab === 0 ? <PsychologyOutlined fontSize="small" /> : undefined}
          iconPosition="start"
          label="AI 및 지식베이스"
        />
        <Tab icon={tab === 3 ? <ShieldOutlined fontSize="small" /> : undefined} iconPosition="start" label="리스크 관리" />
      </Tabs>

      {tab === 0 && (
        <CompanySettings
          companies={companies.data ?? []}
          company={company}
          createCompany={createCompany}
        />
      )}
      {tab === 1 && <MaterialitySettings company={company} />}
      {tab === 2 && (
        <Stack spacing={2.5}>
          <AiSettings />
          <KnowledgeSettings company={company} />
        </Stack>
      )}
      {tab === 3 && <RiskManagementSettings company={company} />}
    </Box>
  );
}

function SettingsHeading({ tab }: { tab: number }) {
  if (tab === 0) {
    return <Box sx={{ mb: 2.5 }}><Typography variant="h4">설정</Typography><Typography color="text.secondary" sx={{ mt: 0.5 }}>회사별 결산 분석 준비 상태와 운영 기준을 관리합니다.</Typography></Box>
  }
  if (tab === 1) {
    return <Box sx={{ mb: 2.5 }}><Breadcrumb current="감사 중요성" /><Typography variant="h4" sx={{ mt: 1 }}>감사 중요성 (Audit Materiality)</Typography></Box>
  }
  if (tab === 3) {
    return <Box sx={{ mb: 2.5 }}><Breadcrumb current="리스크 관리" /><Typography variant="h4" sx={{ mt: 1 }}>리스크 관리</Typography><Typography color="text.secondary" variant="body2" sx={{ mt: .75 }}>리스크 분석 결과를 확인하고, 필요 시 DB에서 영구 삭제합니다.</Typography></Box>
  }
  return <Box sx={{ mb: 2.5 }}><Breadcrumb current="AI 및 지식베이스" /><Typography variant="h4" sx={{ mt: 1 }}>AI 및 지식베이스 설정</Typography><Typography color="text.secondary" variant="body2" sx={{ mt: 0.75 }}>리스크 분석 엔진을 위한 AI 엔진 연결 및 감사 지식베이스(RAG) 문서를 관리합니다.</Typography></Box>
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

function RiskManagementSettings({ company }: { company?: Company }) {
  const queryClient = useQueryClient();
  const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);
  const risks = useQuery({
    queryKey: ["risk-management", company?.id],
    enabled: Boolean(company),
    queryFn: async () => (await api.get<Risk[]>("/settings/risk-management", { params: { company_id: company!.id } })).data,
  });
  const deleteRisk = useMutation({
    mutationFn: async (risk: Risk) => api.delete(`/risks/${risk.id}`, { data: { expected_version: risk.row_version } }),
    onSuccess: async () => {
      setSelectedRisk(null);
      await queryClient.invalidateQueries({ queryKey: ["risk-management"] });
      await queryClient.invalidateQueries({ queryKey: ["risks"] });
      await queryClient.invalidateQueries({ queryKey: ["risk-reviews"] });
    },
  });
  const decisionLabel: Record<string, string> = { CHECK: "Check", PENDING: "Pending", PASS: "Pass" };

  return <>
    <Card sx={cardSx}>
      <Box sx={{ ...cardHeaderSx, bgcolor: "#FAFBFC" }}><SectionTitle icon={<ShieldOutlined sx={{ color: colors.secondary }} />}>리스크 분석 결과 관리</SectionTitle></Box>
      <CardContent sx={{ p: 3 }}>
        <Alert severity="warning" sx={{ mb: 2.5 }}>삭제하면 선택한 리스크 결과와 해당 리스크의 이력·감사 로그가 DB에서 영구 삭제됩니다. 원본 원장·정산표·기준서는 유지됩니다.</Alert>
        <TableContainer sx={{ border: `1px solid ${colors.border}`, borderRadius: "12px" }}>
          <Table size="small"><TableHead><TableRow><TableCell>리스크</TableCell><TableCell>검토 분류</TableCell><TableCell>분석 일시</TableCell><TableCell align="right">관리</TableCell></TableRow></TableHead><TableBody>
            {risks.isLoading ? <TableRow><TableCell colSpan={4} align="center" sx={{ py: 5 }}>불러오는 중...</TableCell></TableRow> :
              !(risks.data?.length) ? <TableRow><TableCell colSpan={4} align="center" sx={{ py: 5, color: colors.secondary }}>저장된 리스크 분석 결과가 없습니다.</TableCell></TableRow> :
                risks.data.map((risk) => <TableRow key={risk.id} hover><TableCell><Typography fontWeight={700}>{risk.title}</Typography><Typography variant="caption" color="text.secondary">{risk.id}</Typography></TableCell><TableCell><Chip size="small" label={decisionLabel[risk.review_decision ?? "CHECK"]} /></TableCell><TableCell>{risk.analyzed_at ? new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(risk.analyzed_at)).replace(",", "") : "-"}</TableCell><TableCell align="right"><Button color="error" size="small" startIcon={<DeleteOutline />} onClick={() => setSelectedRisk(risk)}>영구 삭제</Button></TableCell></TableRow>) }
          </TableBody></Table>
        </TableContainer>
        {deleteRisk.isError && <Alert severity="error" sx={{ mt: 2 }}>리스크 삭제에 실패했습니다. 화면을 새로고침한 뒤 다시 시도해 주세요.</Alert>}
      </CardContent>
    </Card>
    <Dialog open={Boolean(selectedRisk)} onClose={() => !deleteRisk.isPending && setSelectedRisk(null)} maxWidth="xs" fullWidth>
      <DialogTitle>리스크 분석 결과 영구 삭제</DialogTitle>
      <DialogContent><Typography>“{selectedRisk?.title}” 결과를 삭제하시겠습니까?</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>삭제 후 복구할 수 없습니다. 원본 업로드 자료는 삭제되지 않습니다.</Typography></DialogContent>
      <DialogActions><Button disabled={deleteRisk.isPending} onClick={() => setSelectedRisk(null)}>취소</Button><Button color="error" variant="contained" disabled={deleteRisk.isPending} onClick={() => selectedRisk && deleteRisk.mutate(selectedRisk)}>{deleteRisk.isPending ? "삭제 중" : "영구 삭제"}</Button></DialogActions>
    </Dialog>
  </>;
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
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("gpt-4o-mini");
  const [enabled, setEnabled] = useState("false");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);
  const runtime = useQuery({ queryKey: ["runtime-settings"], queryFn: async () => (await api.get("/settings/runtime")).data });
  const connection = runtime.data?.aiConnection;

  useEffect(() => {
    if (!connection) return;
    if (connection.provider) setProvider(String(connection.provider));
    if (connection.chatModel) setModel(String(connection.chatModel));
    setEnabled(connection.enabled ? "true" : "false");
  }, [connection?.provider, connection?.chatModel, connection?.enabled]);

  const save = async () => {
    setMessage("");
    setError("");
    try {
      const result = await api.patch("/settings/ai-connection", {
        provider,
        chat_model: model,
        embedding_model: "text-embedding-3-large",
        secret_reference: "env:OPENAI_API_KEY",
        enabled: enabled === "true",
      });
      await runtime.refetch();
      setMessage(result.data.secretReadable ? "AI 연결 설정을 저장했습니다." : "설정은 저장되었습니다. Vercel 환경변수 OPENAI_API_KEY를 등록하면 AI 기능을 사용할 수 있습니다.");
    } catch {
      setError("AI 연결 설정 저장에 실패했습니다.");
    }
  };

  const testConnection = async () => {
    setMessage("");
    setError("");
    setTesting(true);
    try {
      const result = await api.post("/settings/ai-connection/test", { secret_reference: "env:OPENAI_API_KEY", provider, chat_model: model });
      if (result.data.ok) {
        setMessage(result.data.message);
      } else {
        setError(result.data.message);
      }
    } catch {
      setError("연결 테스트에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setTesting(false);
    }
  };

  return <Card sx={cardSx}>
    <Box sx={{ ...cardHeaderSx, bgcolor: "#FAFBFC" }}><SectionTitle icon={<PsychologyOutlined sx={{ color: colors.secondary }} />}>AI 연결 설정 <Chip icon={<LockOutlined />} label="시스템 관리자 전용" size="small" sx={{ ml: 1, height: 22 }} /></SectionTitle></Box>
    <CardContent sx={{ p: 3 }}>
      <Alert severity="info" icon={<InfoOutlined />} sx={{ mb: 3, bgcolor: "#F1F6FC", color: colors.text, border: "1px solid #D9E7F5" }}>입력한 API 키는 연결 테스트에만 사용하고 서버에 저장하거나 다시 표시하지 않습니다. 운영 연결은 Vercel 환경변수 <b>OPENAI_API_KEY</b>를 사용합니다.</Alert>
      <Grid container spacing={4}>
        <Grid size={{ xs: 12, lg: 8 }}><Box component="form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 6 }}><Field label="PROVIDER"><TextField select value={provider} onChange={(event) => setProvider(event.target.value)} fullWidth sx={fieldSx}><MenuItem value="openai">OpenAI</MenuItem><MenuItem value="nvidia">NVIDIA NIM</MenuItem></TextField></Field></Grid>
            <Grid size={{ xs: 12, md: 6 }}><Field label="CHAT MODEL"><TextField select value={model} onChange={(event) => setModel(event.target.value)} fullWidth sx={fieldSx}><MenuItem value="gpt-4o-mini">gpt-4o-mini</MenuItem><MenuItem value="gpt-4o">gpt-4o</MenuItem><MenuItem value="meta/llama-3.1-70b-instruct">NVIDIA · Llama 3.1 70B</MenuItem><MenuItem value="meta/llama-3.2-3b-instruct">NVIDIA · Llama 3.2 3B</MenuItem></TextField></Field></Grid>
            <Grid size={{ xs: 12, md: 6 }}><Field label="EMBEDDING MODEL"><TextField value="text-embedding-3-large" fullWidth slotProps={{ input: { readOnly: true } }} sx={fieldSx} /></Field></Grid>
            <Grid size={{ xs: 12, md: 6 }}><Field label="AI 기능 상태"><TextField select value={enabled} onChange={(event) => setEnabled(event.target.value)} fullWidth sx={fieldSx}><MenuItem value="false">비활성</MenuItem><MenuItem value="true">활성</MenuItem></TextField></Field></Grid>
          </Grid>
          <Stack direction="row" spacing={1.5} sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${colors.border}` }}><Button type="button" variant="outlined" onClick={() => void testConnection()} disabled={testing} startIcon={<CableOutlined />} sx={{ borderColor: colors.border, color: colors.primary }}>{testing ? "테스트 중" : "연결 테스트"}</Button><Button type="submit" variant="contained" startIcon={<SaveOutlined />} sx={{ bgcolor: colors.primary }}>저장</Button></Stack>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}{message && <Alert severity="success" sx={{ mt: 2 }}>{message}</Alert>}
        </Box></Grid>
        <Grid size={{ xs: 12, lg: 4 }}><Box sx={{ p: 3, bgcolor: colors.canvas, border: `1px solid ${colors.border}`, borderRadius: "12px", height: "100%" }}><Typography variant="caption" color="text.secondary" fontWeight={700}>연결 상태</Typography><Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 2 }}><Box sx={{ width: 48, height: 48, borderRadius: "50%", bgcolor: connection?.secretReadable ? "#E7F7ED" : "#ECEEF0", color: connection?.secretReadable ? colors.success : colors.secondary, display: "grid", placeItems: "center" }}><CheckCircleOutline /></Box><Box><Stack direction="row" spacing={1}><Typography variant="body2" fontWeight={700}>{connection?.secretReadable ? "API 키 연결됨" : "API 키 미설정"}</Typography><Chip label={connection?.configured ? "설정됨" : "검증 전"} size="small" /></Stack><Typography variant="caption" color="text.secondary">저장 후에도 비밀값은 표시하지 않습니다.</Typography></Box></Stack><Stack spacing={1.5} sx={{ mt: 3 }}><PreviewFact label="분당 토큰 한도(TPM)" value="200,000" /><PreviewFact label="분당 요청 한도(RPM)" value="500" /></Stack></Box></Grid>
      </Grid>
    </CardContent>
  </Card>;
}

function KnowledgeSettings({ company }: { company?: Company }) {
  const [rootDirectory, setRootDirectory] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [uploadDialogMessage, setUploadDialogMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const runtime = useQuery({
    queryKey: ["runtime-settings-v2"],
    queryFn: async () => (await api.get("/settings/runtime")).data,
  });
  const candidates = useQuery({
    queryKey: ["knowledge-candidates", company?.id],
    queryFn: async () => (
      await api.get("/settings/knowledge-sources/local-standards/candidates", {
        params: { company_id: company?.id },
      })
    ).data as KnowledgeDocument[],
    enabled: Boolean(company?.id),
  });
  const candidateItems = candidates.data ?? [];
  const approvedCount = candidateItems.filter((item) => item.status === "APPROVED").length;
  const pendingCount = candidateItems.filter((item) => item.status === "PENDING").length;
  const ragAvailableCount = candidateItems.filter((item) => item.ragEligible).length;
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
        `${response.data.uploaded}개 파일을 업로드하고 지식베이스에 등록했습니다.`,
      );
      await candidates.refetch();
    } catch (caught) {
      const detail = (caught as { response?: { data?: { detail?: string } } })
        .response?.data?.detail;
      setUploadDialogMessage(detail ?? "파일 업로드에 실패했습니다. 다시 확인해 주세요.");
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
        `${response.data.scanned}개 파일을 지식베이스에 등록했습니다.`,
      );
      await candidates.refetch();
    } catch {
      setError(
        "폴더 스캔에 실패했습니다. Windows 경로는 Docker에서 직접 스캔할 수 없으므로 파일 업로드를 사용해 주세요.",
      );
    }
  };
  const reindexDocuments = async () => {
    setError("");
    setMessage("");
    try {
      const response = await api.post(
        "/settings/knowledge-sources/local-standards/reindex",
        null,
        { params: { company_id: company.id } },
      );
      const failed = response.data.failures?.length ?? 0;
      setMessage(`RAG 인덱스 생성 완료: ${response.data.indexed}건${failed ? `, 실패 ${failed}건` : ""}`);
      await candidates.refetch();
    } catch (caught) {
      const detail = (caught as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      setError(detail ?? "RAG 인덱스 생성에 실패했습니다.");
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
            <KnowledgeKpi label="승인됨" value={String(approvedCount)} suffix="건" />
            <KnowledgeKpi
              label="승인 대기"
              value={String(pendingCount)}
              suffix="건"
              tone={colors.warning}
            />
            <KnowledgeKpi
              label="RAG 사용 가능"
              value={String(ragAvailableCount)}
              suffix="건"
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
              <Button variant="outlined" onClick={reindexDocuments} disabled={!candidateItems.length}>
                RAG 인덱스 생성
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
          <KnowledgeTable documents={candidateItems} />
        </CardContent>
      </Card>
      <Dialog open={Boolean(uploadDialogMessage)} onClose={() => setUploadDialogMessage("")}> 
        <DialogTitle>파일 업로드 불가</DialogTitle>
        <DialogContent>
          <Typography>{uploadDialogMessage}</Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setUploadDialogMessage("")}>닫기</Button>
        </DialogActions>
      </Dialog>
      <AiSummary footer>
        현재 회사에 등록된 지식베이스 문서는 총 <b>{candidateItems.length}건</b>이며,
        승인됨 {approvedCount}건, 승인 대기 {pendingCount}건, RAG 사용 가능 {ragAvailableCount}건입니다.
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

type KnowledgeDocument = {
  id: string;
  relativePath: string;
  status: string;
  ragEligible: boolean;
  ragStatus?: string;
  chunkCount?: number;
};

function KnowledgeTable({ documents }: { documents: KnowledgeDocument[] }) {
  return (
    <Box sx={{ mt: 3.5 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="body2" fontWeight={700}>
          전체 문서 목록
          <Box component="span" sx={{ color: colors.primary, fontWeight: 400, ml: 0.75 }}>
            {documents.length}
          </Box>
        </Typography>
      </Stack>
      <TableContainer sx={{ border: `1px solid ${colors.border}`, borderRadius: "12px" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {["문서명", "유형", "상태", "RAG 인덱스"].map((item) => (
                <TableCell key={item} align={item === "문서명" || item === "유형" ? "left" : "center"}>
                  {item}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {documents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 4, color: colors.secondary }}>
                  업로드된 문서가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              documents.map((document) => {
                const extension = document.relativePath.split(".").pop()?.toUpperCase() ?? "-";
                const approved = document.status === "APPROVED";
                return (
                  <TableRow key={document.id}>
                    <TableCell>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <PictureAsPdfOutlined sx={{ color: colors.primary }} />
                        <Typography variant="body2" fontWeight={700}>{document.relativePath}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ color: colors.secondary }}>{extension}</TableCell>
                    <TableCell align="center">
                      <StatusChip label={approved ? "승인됨" : "승인 대기"} tone={approved ? "success" : "warning"} />
                    </TableCell>
                    <TableCell align="center">
                      {document.ragStatus === "INDEXED" ? (
                        <Stack alignItems="center" spacing={.25}><CheckCircle sx={{ color: colors.success }} /><Typography variant="caption">청크 {document.chunkCount ?? 0}</Typography></Stack>
                      ) : (
                        <Stack alignItems="center" spacing={.25}><PendingOutlined sx={{ color: "#C2C6D5" }} /><Typography variant="caption">{document.ragStatus === "FAILED" ? "실패" : "미생성"}</Typography></Stack>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
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
