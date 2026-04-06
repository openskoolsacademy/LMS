import { supabase } from '../lib/supabase';
import { generateCertificateId } from './certificateUtils';

export async function createStudentCertificate(user, courseId, courseTitle, profileName) {
  try {
    // 1. Check if already generated in logs
    const { data: existingLog } = await supabase
      .from('certificate_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .single();

    if (existingLog) return existingLog;

    // 2. Generate new OPSK ID
    const { data: logs } = await supabase.from('certificate_logs').select('certificate_id');
    const existingIds = (logs || []).map(l => l.certificate_id);
    const newOpskId = generateCertificateId(existingIds);

    // 3. Mark in raw 'certificates' table (for internal query constraints if any)
    const { error: rawErr } = await supabase.from('certificates').insert([{
      user_id: user.id,
      course_id: courseId
    }]);
    // Ignore duplicate error if they already had a raw certificate record but no log
    if (rawErr && rawErr.code !== '23505') throw rawErr;

    // 4. Insert into bulk_certificates for public verification
    await supabase.from('bulk_certificates').insert([{
      certificate_id: newOpskId,
      student_name: profileName || user.email,
      course_name: courseTitle,
      certificate_type: 'course',
      status: 'valid'
    }]);

    // 5. Insert into certificate_logs
    const { data: newLog, error: logErr } = await supabase.from('certificate_logs').insert([{
      certificate_id: newOpskId,
      user_id: user.id,
      course_id: courseId,
      student_name: profileName || user.email,
      student_email: user.email,
      course_name: courseTitle,
      certificate_type: 'course',
      status: 'active',
      issued_by: 'System',
      issued_at: new Date().toISOString()
    }]).select().single();

    if (logErr) throw logErr;
    return newLog;
  } catch (err) {
    console.error('Error creating student certificate:', err);
    throw err;
  }
}

/**
 * Create a certificate for event attendance
 * @param {Object} user - Auth user object
 * @param {string} eventId - Event UUID
 * @param {string} eventTitle - Event title
 * @param {string} instructorName - Speaker/instructor name
 * @param {string} profileName - Student display name
 * @returns {Object} Certificate log record
 */
export async function createEventCertificate(user, eventId, eventTitle, instructorName, profileName) {
  try {
    // 1. Check if already generated
    const { data: existingAttendance } = await supabase
      .from('event_attendance')
      .select('certificate_id')
      .eq('user_id', user.id)
      .eq('event_id', eventId)
      .single();

    if (existingAttendance?.certificate_id) {
      // Already has a certificate — fetch the log
      const { data: existingLog } = await supabase
        .from('certificate_logs')
        .select('*')
        .eq('certificate_id', existingAttendance.certificate_id)
        .single();
      if (existingLog) return existingLog;
    }

    // 2. Generate new OPSK ID
    const { data: logs } = await supabase.from('certificate_logs').select('certificate_id');
    const existingIds = (logs || []).map(l => l.certificate_id);
    const newOpskId = generateCertificateId(existingIds);

    // 3. Insert into bulk_certificates for public verification
    await supabase.from('bulk_certificates').insert([{
      certificate_id: newOpskId,
      student_name: profileName || user.email,
      course_name: eventTitle,
      certificate_type: 'live',
      instructor_name: instructorName || 'Open Skools',
      status: 'valid'
    }]);

    // 4. Insert into certificate_logs
    const { data: newLog, error: logErr } = await supabase.from('certificate_logs').insert([{
      certificate_id: newOpskId,
      user_id: user.id,
      student_name: profileName || user.email,
      student_email: user.email,
      course_name: eventTitle,
      certificate_type: 'live',
      status: 'active',
      issued_by: instructorName || 'Open Skools',
      issued_at: new Date().toISOString()
    }]).select().single();

    if (logErr) throw logErr;

    // 5. Update event_attendance with certificate info
    await supabase
      .from('event_attendance')
      .update({
        certificate_issued: true,
        certificate_id: newOpskId
      })
      .eq('user_id', user.id)
      .eq('event_id', eventId);

    return newLog;
  } catch (err) {
    console.error('Error creating event certificate:', err);
    throw err;
  }
}

/**
 * Log a certificate generation event
 * @param {Object} data 
 */
export async function logCertificateAction(data) {
  try {
    const { error } = await supabase.from('certificate_logs').insert({
      certificate_id: data.certificate_id,
      student_name: data.student_name,
      student_email: data.student_email,
      course_name: data.course_name,
      certificate_type: data.certificate_type || 'course',
      issued_by: data.issued_by || 'System',
      status: 'active',
      user_id: data.user_id || null,
      course_id: data.course_id || null,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      issued_at: new Date().toISOString()
    });
    
    if (error) {
      // If table doesn't exist, we don't want to crash the whole app
      if (error.code === '42P01') {
        console.warn('certificate_logs table does not exist. Please run schema setup.');
      } else {
        throw error;
      }
    }
  } catch (err) {
    console.error('Error logging certificate:', err);
  }
}

/**
 * Fetch certificate logs with filters and pagination
 */
export async function getCertificateLogs({ 
  page = 1, 
  limit = 10, 
  search = '', 
  course = 'all', 
  type = 'all', 
  status = 'all',
  dateFrom = '',
  dateTo = ''
}) {
  try {
    let query = supabase.from('certificate_logs').select('*', { count: 'exact' });
    
    // Filters
    if (search) {
      query = query.or(`student_name.ilike.%${search}%,student_email.ilike.%${search}%,certificate_id.ilike.%${search}%`);
    }
    if (course !== 'all') {
      query = query.eq('course_name', course);
    }
    if (type !== 'all') {
      query = query.eq('certificate_type', type);
    }
    if (status !== 'all') {
      query = query.eq('status', status);
    }
    if (dateFrom) {
      query = query.gte('issued_at', `${dateFrom}T00:00:00`);
    }
    if (dateTo) {
      query = query.lte('issued_at', `${dateTo}T23:59:59`);
    }
    
    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    
    const { data, count, error } = await query
      .order('issued_at', { ascending: false })
      .range(from, to);
      
    if (error) throw error;
    return { data, count };
  } catch (err) {
    console.error('Error fetching certificate logs:', err);
    return { data: [], count: 0 };
  }
}

/**
 * Revoke or Reactivate a certificate
 */
export async function updateCertificateStatus(id, status) {
  try {
    const { error } = await supabase
      .from('certificate_logs')
      .update({ status })
      .eq('id', id);
      
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error updating certificate status:', err);
    return false;
  }
}

/**
 * Increment download count
 */
export async function logDownload(certificateId) {
  try {
    // Correct way to increment in Supabase
    const { data, error } = await supabase.rpc('increment_cert_download', { cert_id: certificateId });
    
    // Fallback if RPC not setup
    if (error) {
      const { data: current } = await supabase
        .from('certificate_logs')
        .select('download_count')
        .eq('certificate_id', certificateId)
        .single();
        
      if (current) {
        await supabase
          .from('certificate_logs')
          .update({ download_count: (current.download_count || 0) + 1 })
          .eq('certificate_id', certificateId);
      }
    }
  } catch (err) {
    console.error('Error logging download:', err);
  }
}
