import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const LINE_ACCESS_TOKEN = Deno.env.get("LINE_ACCESS_TOKEN");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // รับค่า siteUrl เพิ่มเติมจากหน้าบ้าน เพื่อนำไปทำปุ่มลิงก์
    const { task, userIds, assignerName, siteUrl } = await req.json();

    if (!task || !userIds || userIds.length === 0) {
      return new Response(JSON.stringify({ message: "No data or users to notify" }), { headers: corsHeaders });
    }

    // จัดรูปแบบวันที่ให้เป็น "01 มิ.ย. 2569" เหมือนกันทุกการแจ้งเตือน
    const dateObj = new Date(task.date);
    const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const dayTwoDigits = String(dateObj.getDate()).padStart(2, '0');
    const formattedDate = `${dayTwoDigits} ${thaiMonths[dateObj.getMonth()]} ${dateObj.getFullYear() + 543}`;
    const formattedTime = task.time ? `${task.time.substring(0, 5)} น.` : 'ไม่ระบุ';

    // โครงสร้างการ์ด Flex Message ใหม่
    const flexMessage = {
      type: "flex",
      altText: `📢 มีกิจกรรมใหม่: ${task.title}`,
      contents: {
        type: "bubble",
        size: "mega",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#2563EB",
          paddingAll: "xl",
          contents: [
            { type: "text", text: "📢 มอบหมายกิจกรรมใหม่", color: "#FFFFFF", weight: "bold", size: "md" }
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
                  { type: "text", text: "👤 มอบหมายโดย:", color: "#9ca3af", size: "sm", flex: 2 }, // เปลี่ยนหัวข้อตามต้องการ
                  { type: "text", text: assignerName, wrap: true, color: "#4b5563", size: "sm", flex: 5 }
                ]}
              ]
            }
            // ตัดส่วนรายละเอียดเพิ่มเติม (Description) ออกเรียบร้อยเพื่อให้มากดอ่านในระบบ
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
                uri: siteUrl || "https://school-task-manager-tau.vercel.app/" // ลิงก์ปลายทางเปิดหน้าเว็บระบบงาน
              }
            }
          ]
        }
      }
    };

    const response = await fetch("https://api.line.me/v2/bot/message/multicast", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LINE_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        to: userIds,
        messages: [flexMessage]
      })
    });

    const data = await response.json();

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});