import { supabase } from './supabase';

export const enqueuePrintJob = async (
  orderId: string | null,
  ticketType: 'kitchen' | 'invoice' | 'receipt',
  content: any,
  printerTarget: string | null = null
): Promise<boolean> => {
  try {
    const { error } = await supabase.from('print_jobs').insert({
      order_id: orderId,
      ticket_type: ticketType,
      status: 'pending',
      content,
      printer_target: printerTarget
    });

    if (error) {
      console.error('Error enqueuing print job:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Exception enqueuing print job:', err);
    return false;
  }
};
