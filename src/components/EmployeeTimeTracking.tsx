import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Clock, Calendar, DollarSign, TrendingUp, Download, User, FileSpreadsheet } from 'lucide-react';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';

interface Employee {
  id: string;
  full_name: string;
  role: string;
  email: string;
  phone: string;
  active: boolean;
  created_at: string;
}

interface CompanySettings {
  id: string;
  company_name: string;
  address: string;
  phone: string;
}

interface WorkSession {
  id: string;
  opened_at: string;
  closed_at: string | null;
  opening_amount: number;
  closing_amount: number | null;
  status: string;
  hours_worked: number;
}

interface DayStats {
  date: string;
  sessions: WorkSession[];
  total_hours: number;
  total_sales: number;
  orders_count: number;
  first_check_in: string;
  last_check_out: string | null;
}

interface MonthStats {
  total_days_worked: number;
  total_hours_worked: number;
  average_hours_per_day: number;
  total_sales: number;
  total_orders: number;
}

export function EmployeeTimeTracking() {
  const { profile } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [dayStats, setDayStats] = useState<DayStats[]>([]);
  const [monthStats, setMonthStats] = useState<MonthStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);

  useEffect(() => {
    fetchEmployees();
    fetchCompanySettings();

    // Listen for company settings updates
    const handleCompanySettingsUpdate = (event: any) => {
      console.log('Company settings updated in EmployeeTimeTracking:', event.detail);
      if (event.detail) {
        setCompanySettings(event.detail);
      }
    };

    window.addEventListener('companySettingsUpdated', handleCompanySettingsUpdate);

    return () => {
      window.removeEventListener('companySettingsUpdated', handleCompanySettingsUpdate);
    };
  }, []);

  useEffect(() => {
    if (selectedEmployee) {
      fetchEmployeeStats();
    }
  }, [selectedEmployee, selectedMonth]);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employee_profiles')
        .select('*')
        .eq('active', true)
        .is('deleted_at', null)
        .order('full_name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Error al cargar empleados');
    }
  };

  const fetchCompanySettings = async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .single();

      if (error) throw error;

      if (data) {
        setCompanySettings(data);
      }
    } catch (error) {
      console.error('Error fetching company settings:', error);
      // Don't show error toast for company settings as it's not critical for the main functionality
    }
  };

  const fetchEmployeeStats = async () => {
    if (!selectedEmployee) return;

    setLoading(true);
    try {
      const startDate = `${selectedMonth}-01`;
      const endDate = new Date(selectedMonth + '-01');
      endDate.setMonth(endDate.getMonth() + 1);
      const endDateStr = endDate.toISOString().split('T')[0];

      // Obtener sesiones de caja del mes
      const { data: sessions, error: sessionsError } = await supabase
        .from('cash_register_sessions')
        .select('*')
        .eq('employee_id', selectedEmployee.id)
        .gte('opened_at', startDate)
        .lt('opened_at', endDateStr)
        .order('opened_at', { ascending: true });

      if (sessionsError) throw sessionsError;

      // Obtener órdenes del mes
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('total, created_at, status')
        .eq('employee_id', selectedEmployee.id)
        .gte('created_at', startDate)
        .lt('created_at', endDateStr)
        .eq('status', 'completed');

      if (ordersError) throw ordersError;

      // Agrupar sesiones por día
      const dayStatsMap = new Map<string, DayStats>();

      sessions?.forEach((session) => {
        const date = session.opened_at.split('T')[0];

        if (!dayStatsMap.has(date)) {
          dayStatsMap.set(date, {
            date,
            sessions: [],
            total_hours: 0,
            total_sales: 0,
            orders_count: 0,
            first_check_in: session.opened_at,
            last_check_out: session.closed_at,
          });
        }

        const dayData = dayStatsMap.get(date)!;

        // Calcular horas trabajadas
        let hoursWorked = 0;
        if (session.closed_at) {
          const opened = new Date(session.opened_at);
          const closed = new Date(session.closed_at);
          hoursWorked = (closed.getTime() - opened.getTime()) / (1000 * 60 * 60);
        }

        dayData.sessions.push({
          ...session,
          hours_worked: hoursWorked,
        });

        dayData.total_hours += hoursWorked;

        // Actualizar primera entrada y última salida
        if (new Date(session.opened_at) < new Date(dayData.first_check_in)) {
          dayData.first_check_in = session.opened_at;
        }
        if (session.closed_at && (!dayData.last_check_out || new Date(session.closed_at) > new Date(dayData.last_check_out))) {
          dayData.last_check_out = session.closed_at;
        }
      });

      // Agregar ventas por día
      orders?.forEach((order) => {
        const date = order.created_at.split('T')[0];
        if (dayStatsMap.has(date)) {
          const dayData = dayStatsMap.get(date)!;
          dayData.total_sales += order.total;
          dayData.orders_count += 1;
        }
      });

      const dayStatsArray = Array.from(dayStatsMap.values()).sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      // Calcular estadísticas del mes
      const totalHours = dayStatsArray.reduce((sum, day) => sum + day.total_hours, 0);
      const totalSales = dayStatsArray.reduce((sum, day) => sum + day.total_sales, 0);
      const totalOrders = dayStatsArray.reduce((sum, day) => sum + day.orders_count, 0);

      setDayStats(dayStatsArray);
      setMonthStats({
        total_days_worked: dayStatsArray.length,
        total_hours_worked: totalHours,
        average_hours_per_day: dayStatsArray.length > 0 ? totalHours / dayStatsArray.length : 0,
        total_sales: totalSales,
        total_orders: totalOrders,
      });
    } catch (error) {
      console.error('Error fetching employee stats:', error);
      toast.error('Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    if (!selectedEmployee || !monthStats || dayStats.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }

    toast.loading('Generando reporte...', { id: 'export' });

    try {
      const wb = XLSX.utils.book_new();

      // Hoja 1: Resumen
      const summaryData = [
        ['🏢 INFORMACIÓN DE LA EMPRESA'],
        [''],
        ...(companySettings ? [
          ['EMPRESA', companySettings.company_name],
          ['DIRECCIÓN', companySettings.address || 'No especificada'],
          ['TELÉFONO', companySettings.phone || 'No especificado'],
          [''],
        ] : [
          ['EMPRESA', 'No configurada'],
          [''],
        ]),
        ['📊 REPORTE DE TIEMPO Y RENDIMIENTO'],
        [''],
        ['EMPLEADO', selectedEmployee.full_name],
        ['ROL', selectedEmployee.role],
        ['EMAIL', selectedEmployee.email],
        ['PERIODO', new Date(selectedMonth).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })],
        ['FECHA DE GENERACIÓN', new Date().toLocaleDateString('es-ES')],
        [''],
        ['═'.repeat(60)],
        ['📈 RESUMEN DEL MES'],
        ['═'.repeat(60)],
        [''],
        ['MÉTRICA', 'VALOR'],
        ['📅 Días Trabajados', monthStats.total_days_worked],
        ['⏰ Horas Totales', `${monthStats.total_hours_worked.toFixed(2)} hrs`],
        ['📊 Promedio Horas/Día', `${monthStats.average_hours_per_day.toFixed(2)} hrs`],
        ['💰 Ventas Generadas', `$${monthStats.total_sales.toFixed(2)}`],
        ['📦 Pedidos Completados', monthStats.total_orders],
        ['💵 Ventas/Hora', monthStats.total_hours_worked > 0 ? `$${(monthStats.total_sales / monthStats.total_hours_worked).toFixed(2)}` : '$0.00'],
      ];

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      wsSummary['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
        { s: { r: 9, c: 0 }, e: { r: 9, c: 1 } },
        { s: { r: 10, c: 0 }, e: { r: 10, c: 1 } },
      ];
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen');

      // Hoja 2: Desglose Diario
      const dailyData = [
        ['🏢 INFORMACIÓN DE LA EMPRESA'],
        [''],
        ...(companySettings ? [
          ['EMPRESA', companySettings.company_name],
          ['DIRECCIÓN', companySettings.address || 'No especificada'],
          ['TELÉFONO', companySettings.phone || 'No especificado'],
          [''],
        ] : [
          ['EMPRESA', 'No configurada'],
          [''],
        ]),
        ['📅 DESGLOSE DIARIO DE TRABAJO'],
        [''],
        ['EMPLEADO', selectedEmployee.full_name],
        ['PERIODO', new Date(selectedMonth).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })],
        [''],
        ['FECHA', 'DÍA', 'ENTRADA', 'SALIDA', 'HORAS', 'SESIONES', 'VENTAS', 'PEDIDOS', 'VENTAS/HORA'],
      ];

      dayStats.forEach((day) => {
        const date = new Date(day.date);
        const dayName = date.toLocaleDateString('es-ES', { weekday: 'long' });
        const entry = day.first_check_in ? new Date(day.first_check_in).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '-';
        const exit = day.last_check_out ? new Date(day.last_check_out).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : 'En curso';
        const salesPerHour = day.total_hours > 0 ? day.total_sales / day.total_hours : 0;

        dailyData.push([
          date.toLocaleDateString('es-ES'),
          dayName.charAt(0).toUpperCase() + dayName.slice(1),
          entry,
          exit,
          `${day.total_hours.toFixed(2)} hrs`,
          day.sessions.length,
          `$${day.total_sales.toFixed(2)}`,
          day.orders_count,
          `$${salesPerHour.toFixed(2)}/hr`,
        ]);
      });

      const wsDaily = XLSX.utils.aoa_to_sheet(dailyData);
      wsDaily['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
      ];
      XLSX.utils.book_append_sheet(wb, wsDaily, 'Desglose_Diario');

      // Hoja 3: Detalle de Sesiones
      const sessionsData = [
        ['🏢 INFORMACIÓN DE LA EMPRESA'],
        [''],
        ...(companySettings ? [
          ['EMPRESA', companySettings.company_name],
          ['DIRECCIÓN', companySettings.address || 'No especificada'],
          ['TELÉFONO', companySettings.phone || 'No especificado'],
          [''],
        ] : [
          ['EMPRESA', 'No configurada'],
          [''],
        ]),
        ['🕐 DETALLE DE SESIONES DE TRABAJO'],
        [''],
        ['EMPLEADO', selectedEmployee.full_name],
        ['PERIODO', new Date(selectedMonth).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })],
        [''],
        ['FECHA', 'APERTURA', 'CIERRE', 'DURACIÓN', 'MONTO INICIAL', 'MONTO FINAL', 'DIFERENCIA', 'ESTADO'],
      ];

      dayStats.forEach((day) => {
        day.sessions.forEach((session) => {
          const date = new Date(session.opened_at).toLocaleDateString('es-ES');
          const opened = new Date(session.opened_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
          const closed = session.closed_at ? new Date(session.closed_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : 'Abierta';
          const duration = `${session.hours_worked.toFixed(2)} hrs`;
          const difference = session.closing_amount ? session.closing_amount - session.opening_amount : 0;

          sessionsData.push([
            date,
            opened,
            closed,
            duration,
            `$${session.opening_amount.toFixed(2)}`,
            session.closing_amount ? `$${session.closing_amount.toFixed(2)}` : 'N/A',
            `$${difference.toFixed(2)}`,
            session.status === 'closed' ? 'Cerrada' : 'Abierta',
          ]);
        });
      });

      const wsSessions = XLSX.utils.aoa_to_sheet(sessionsData);
      wsSessions['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
      ];
      XLSX.utils.book_append_sheet(wb, wsSessions, 'Sesiones');

      // Generar nombre de archivo
      const monthName = new Date(selectedMonth).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      const filename = `Reporte_Tiempo_${selectedEmployee.full_name.replace(/\s+/g, '_')}_${monthName.replace(/\s+/g, '_')}.xlsx`;

      // Descargar archivo
      XLSX.writeFile(wb, filename);

      toast.success('Reporte generado exitosamente', { id: 'export' });
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Error al generar reporte', { id: 'export' });
    }
  };

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Gestión de Tiempo de Empleados</h2>
          {selectedEmployee && dayStats.length > 0 && (
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors shadow-md"
            >
              <FileSpreadsheet className="w-5 h-5" />
              <span>Exportar Excel</span>
            </button>
          )}
        </div>

        {/* Selector de Empleado y Mes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Seleccionar Empleado
            </label>
            <select
              value={selectedEmployee?.id || ''}
              onChange={(e) => {
                const emp = employees.find(employee => employee.id === e.target.value);
                setSelectedEmployee(emp || null);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            >
              <option value="">-- Seleccione un empleado --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} ({emp.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mes
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              max={new Date().toISOString().slice(0, 7)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando estadísticas...</p>
          </div>
        </div>
      ) : selectedEmployee ? (
        <>
          {/* Estadísticas del Mes */}
          {monthStats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <Calendar className="w-8 h-8 opacity-80" />
                  <span className="text-xs font-medium opacity-90">Días</span>
                </div>
                <p className="text-3xl font-bold mb-1">{monthStats.total_days_worked}</p>
                <p className="text-sm opacity-90">Días trabajados</p>
              </div>

              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <Clock className="w-8 h-8 opacity-80" />
                  <span className="text-xs font-medium opacity-90">Total</span>
                </div>
                <p className="text-3xl font-bold mb-1">{monthStats.total_hours_worked.toFixed(1)}</p>
                <p className="text-sm opacity-90">Horas trabajadas</p>
              </div>

              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp className="w-8 h-8 opacity-80" />
                  <span className="text-xs font-medium opacity-90">Promedio</span>
                </div>
                <p className="text-3xl font-bold mb-1">{monthStats.average_hours_per_day.toFixed(1)}</p>
                <p className="text-sm opacity-90">Horas por día</p>
              </div>

              <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <DollarSign className="w-8 h-8 opacity-80" />
                  <span className="text-xs font-medium opacity-90">Ventas</span>
                </div>
                <p className="text-3xl font-bold mb-1">${monthStats.total_sales.toFixed(0)}</p>
                <p className="text-sm opacity-90">Generadas</p>
              </div>
            </div>
          )}

          {/* Tabla de Días */}
          {dayStats.length > 0 ? (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-amber-500 to-orange-500">
                <h3 className="text-lg font-bold text-white">Desglose Diario</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fecha
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Entrada
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Salida
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Horas
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Sesiones
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ventas
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Pedidos
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dayStats.map((day) => (
                      <tr key={day.date} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {new Date(day.date).toLocaleDateString('es-ES', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short'
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(day.first_check_in).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {day.last_check_out
                            ? new Date(day.last_check_out).toLocaleTimeString('es-ES', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : 'En curso'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                            {day.total_hours.toFixed(2)} hrs
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {day.sessions.length}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                          ${day.total_sales.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {day.orders_count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">
                No hay registros de trabajo para este empleado en el mes seleccionado
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Seleccione un empleado para ver sus estadísticas</p>
        </div>
      )}
    </div>
  );
}
