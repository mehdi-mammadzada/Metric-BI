// Mərkəzləşdirilmiş inteqrasiya kataloqu — İnteqrasiyalar modulu və KPI sihirbazı
// (qiymətləndirici seçimi) eyni mənbədən istifadə edir.

export interface IntegrationDataField {
  name: string;
  description: string;
}

export interface IntegrationSystem {
  name: string;
  fullName: string;
  description: string;
  status: "Aktiv" | "Xəta";
  errorCount?: number;
  logoKey?: "chr";
  iconKey: "database" | "mail" | "shield" | "boxes";
  details: string;
  modules: string[];
  lastSync: string;
  dataFields: IntegrationDataField[];
  direction: "in" | "out";
  errors?: { code: string; message: string; time: string }[];
}

export const INTEGRATION_CATALOG: IntegrationSystem[] = [
  {
    name: "CHR",
    fullName: "Core Human Resources",
    description: "HR idarəetmə sistemi inteqrasiyası",
    status: "Aktiv",
    iconKey: "boxes",
    logoKey: "chr",
    direction: "in",
    details: "CHR sistemindən işçi məlumatları və maaş hesablamaları daxil olur.",
    modules: ["İşçi Məlumatları", "Maaş Hesablaması", "Davamiyyət", "Məzuniyyət"],
    lastSync: "14.04.2026 09:30",
    dataFields: [
      { name: "employee_id", description: "Əməkdaş identifikatoru" },
      { name: "full_name", description: "Tam ad və soyad" },
      { name: "department_code", description: "Departament kodu" },
      { name: "position_title", description: "Vəzifə adı" },
      { name: "base_salary", description: "Baza maaş (AZN)" },
      { name: "hire_date", description: "İşə qəbul tarixi" },
    ],
  },
  {
    name: "CRM Sistemi",
    fullName: "Customer Relationship Management",
    description: "Müştəri əlaqələri sistemi",
    status: "Aktiv",
    iconKey: "database",
    direction: "in",
    details: "CRM sistemindən müştəri və satış göstəriciləri daxil olur.",
    modules: ["Müştəri Bazası", "Satış Pipeline", "CSAT"],
    lastSync: "14.04.2026 08:45",
    dataFields: [
      { name: "sales_total", description: "Dövrlük satış cəmi" },
      { name: "new_customers", description: "Yeni müştəri sayı" },
      { name: "pipeline_value", description: "Aktiv pipeline (AZN)" },
      { name: "csat_score", description: "Müştəri məmnuniyyət xalı" },
    ],
  },
  {
    name: "SIEM Platform",
    fullName: "Security Incident & Event Management",
    description: "Kibertəhlükəsizlik hadisələrinin ötürülməsi",
    status: "Xəta",
    errorCount: 1,
    iconKey: "shield",
    direction: "out",
    details: "Sistemdən insident və audit hadisələri SIEM platformasına ötürülür.",
    modules: ["İnsidentlər", "Audit Logları"],
    lastSync: "14.04.2026 11:00",
    dataFields: [
      { name: "incident_id", description: "İnsident identifikatoru" },
      { name: "severity_level", description: "Təhlükə səviyyəsi" },
      { name: "compliance_score", description: "Uyğunluq xalı (%)" },
    ],
    errors: [
      { code: "SIEM-503", message: "API timeout — endpoint cavab vermir (30s)", time: "14.04.2026 10:55" },
    ],
  },
  {
    name: "Microsoft 365",
    fullName: "Microsoft 365 Suite",
    description: "Hesabat və bildirişlərin ötürülməsi",
    status: "Xəta",
    errorCount: 3,
    iconKey: "mail",
    direction: "out",
    details: "Outlook, Excel və Teams kanallarına hesabatlar göndərilir.",
    modules: ["Outlook E-poçt", "Excel Hesabatlar", "Teams Bildirişlər"],
    lastSync: "14.04.2026 10:15",
    dataFields: [
      { name: "report_file_url", description: "Excel hesabat linki" },
      { name: "calendar_events", description: "Təqvim hadisələri" },
      { name: "teams_channel_id", description: "Teams kanal ID" },
    ],
    errors: [
      { code: "M365-401", message: "OAuth token müddəti bitib", time: "14.04.2026 09:00" },
      { code: "M365-429", message: "API rate-limit aşılıb", time: "14.04.2026 09:30" },
      { code: "M365-500", message: "Teams kanal tapılmadı (channel_id: prj-42)", time: "14.04.2026 10:10" },
    ],
  },
];

export const getIntegrationSystem = (name: string) =>
  INTEGRATION_CATALOG.find((i) => i.name === name);
