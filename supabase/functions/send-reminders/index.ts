import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LINE_ACCESS_TOKEN = Deno.env.get("LINE_ACCESS_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ฟังก์ชันสร้างการ์ด Flex Message
const createReminderFlexMessage = (task: any, siteUrl: string) => {
  // จัดรูปแบบวันที่ให้เป็น "01 มิ.ย. 2569"
  const dateObj = new Date(task.date);
  const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const dayTwoDigits = String(dateObj.getDate()).padStart(2, '0');
  const formattedDate = `${dayTwoDigits} ${thaiMonths[dateObj.getMonth()]} ${dateObj.getFullYear() + 543}`;
  const formattedTime = task.time ? `${task.time.substring(0, 5)} น.` : 'ไม่ระบุ';

  return {
    type: "flex",
    altText: `⏰ เตือนความจำ: ${task.title}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#2563EB", // สีน้ำเงินเข้ากับธีม
        paddingAll: "xl",
        contents: [
          { type: "text", text: "⏰ เตือนความจำกิจกรรมพรุ่งนี้", color: "#FFFFFF", weight: "bold", size: "md" }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        paddingAll: "xl",
        contents: [
          { type: "text", text: task.title, weight: "bold", size: "xl", wrap: true, color: "#1f2937" },
          { type: "separator", margin: "md" },
          {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            margin: "md",
            contents: [
              { type: "box", layout: "baseline", spacing: "sm", contents: [
                { type: "text", text: "📅 วันที่:", color: "#9ca3af", size: "sm", flex: 2 },
                { type: "text", text: formattedDate, wrap: true, color: "#4b5563", size: "sm", flex: 5, weight: "bold" }
              ]},
              { type: "box", layout: "baseline", spacing: "sm", contents: [
                { type: "text", text: "⏰ เวลา:", color: "#9ca3af", size: "sm", flex: 2 },
                { type: "text", text: formattedTime, wrap: true, color: "#4b5563", size: "sm", flex: 5, weight: "bold" }
              ]},
              { type: "box", layout: "baseline", spacing: "sm", contents: [
                { type: "text", text: "📍 สถานที่:", color: "#9ca3af", size: "sm", flex: 2 },
                { type: "text", text: task.location || 'ไม่ระบุ', wrap: true, color: "#4b5563", size: "sm", flex: 5 }
              ]},
              { type: "box", layout: "baseline", spacing: "sm", contents: [
                { type: "text", text: "🏷️ ฝ่าย/งาน:", color: "#9ca3af", size: "sm", flex: 2 },
                { type: "text", text: task.department || 'ไม่ระบุ', wrap: true, color: "#4b5563", size: "sm", flex: 5 }
              ]}
            ]
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#f9fafb",
        paddingAll: "md",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#2563EB",
            height: "sm",
            action: {
              type: "uri",
              label: "รายละเอียดกิจกรรม",
              uri: siteUrl
            }
          }
        ]
      }
    }
  };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const siteUrl = "https://school-task-manager-tau.vercel.app/"; // URL ของเว็บคุณ

    // 1. คำนวณหาวันที่ของ "พรุ่งนี้"
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0]; // ได้รูปแบบ YYYY-MM-DD

    // 2. ดึงข้อมูลงานที่จะเกิดขึ้นในวันพรุ่งนี้ พร้อมรายชื่อคนรับผิดชอบที่ผูก LINE ไว้
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select(`
        *,
        task_assignees!inner (
          staff:staff_id ( id, name, line_user_id )
        )
      `)
      .eq('date', tomorrowStr);

    if (tasksError) throw tasksError;

    if (!tasks || tasks.length === 0) {
      return new Response(JSON.stringify({ message: "No tasks for tomorrow" }), { headers: corsHeaders });
    }

    const results = [];

    // 3. วนลูปส่งแจ้งเตือนทีละงานให้ผู้รับผิดชอบและกลุ่ม
    for (const task of tasks) {
      // คัดกรองเอาเฉพาะคนที่มี line_user_id 
      // (ข้อมูลจะซ้อนอยู่ใน task.task_assignees[i].staff.line_user_id)
      const lineUserIds = task.task_assignees
        .map((assignee: any) => assignee.staff?.line_user_id)
        .filter((id: any) => id != null);

      const flexMessage = createReminderFlexMessage(task, siteUrl);
      const promises = [];

      // ส่งเข้าแชทส่วนตัวของผู้รับผิดชอบ
      if (lineUserIds.length > 0) {
        promises.push(
          fetch("https://api.line.me/v2/bot/message/multicast", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${LINE_ACCESS_TOKEN}`
            },
            body: JSON.stringify({
              to: lineUserIds,
              messages: [flexMessage]
            })
          }).then(res => res.json())
        );
      }



      if (promises.length > 0) {
        const taskResults = await Promise.all(promises);
        results.push({ 
          taskId: task.id, 
          sentToUsers: lineUserIds.length, 
          result: taskResults 
        });
      }
    }

    return new Response(JSON.stringify({ success: true, processedTasks: tasks.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});