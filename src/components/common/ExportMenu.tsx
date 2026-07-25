import { Download, FileSpreadsheet, FileText } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { exportToExcel, exportToPdf, type ExportData } from "@/lib/exportHelpers";

interface Props {
  /** Hər dəfə klik olunduqda yenidən hesablanan məlumat istehsalçısı */
  getData: () => ExportData;
  /** Düymə görünüşü */
  variant?: "outline" | "primary" | "ghost";
  /** Düymə ölçüsü */
  size?: "sm" | "md";
  /** Disabled vəziyyəti */
  disabled?: boolean;
  /** Yalnız ikon (kompakt) */
  iconOnly?: boolean;
  /** Əlavə class */
  className?: string;
  /** Successdən sonra çağırılır */
  onExported?: (format: "excel" | "pdf") => void;
}

const ExportMenu = ({
  getData,
  variant = "outline",
  size = "md",
  disabled,
  iconOnly,
  className = "",
  onExported,
}: Props) => {
  const handle = (format: "excel" | "pdf") => {
    try {
      const data = getData();
      if (!data.rows || data.rows.length === 0) {
        toast.error("İxrac üçün məlumat yoxdur");
        return;
      }
      if (format === "excel") exportToExcel(data);
      else exportToPdf(data);
      toast.success(`${data.rows.length} sətir ${format === "excel" ? "Excel" : "PDF"} olaraq yükləndi`);
      onExported?.(format);
    } catch (err) {
      console.error(err);
      toast.error("İxrac zamanı xəta baş verdi");
    }
  };

  const base =
    "inline-flex items-center gap-2 font-medium transition-colors rounded-lg disabled:opacity-50 disabled:cursor-not-allowed";
  const sizeCls = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";
  const variantCls =
    variant === "primary"
      ? "bg-primary text-primary-foreground hover:bg-primary/90"
      : variant === "ghost"
      ? "hover:bg-secondary text-foreground"
      : "border border-border bg-card text-foreground hover:bg-secondary";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button disabled={disabled} className={`${base} ${sizeCls} ${variantCls} ${className}`}>
          <Download className={size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} />
          {!iconOnly && "Export"}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => handle("excel")} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="w-4 h-4 text-green-600" />
          <span>Excel (.xlsx)</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handle("pdf")} className="gap-2 cursor-pointer">
          <FileText className="w-4 h-4 text-red-600" />
          <span>PDF (.pdf)</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ExportMenu;
