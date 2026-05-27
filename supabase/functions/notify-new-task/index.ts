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
    // เพิ่มรับค่า actionType ('create', 'update', 'delete')
    const { task, userIds, assignerName, siteUrl, actionType = 'create' } = await req.json();

    if (!task || !userIds || userIds.length === 0) {
      return new Response(JSON.stringify({ message: "No data or users to notify" }), { headers: corsHeaders });
    }

    const dateObj = new Date(task.date);
    const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const dayTwoDigits = String(dateObj.getDate()).padStart(2, '0');
    const formattedDate = `${dayTwoDigits} ${thaiMonths[dateObj.getMonth()]} ${dateObj.getFullYear() + 543}`;
    const formattedTime = task.time ? `${task.time.substring(0, 5)} น.` : 'ไม่ระบุ';

    // 🎨 กำหนดสีและข้อความตามการกระทำ (actionType)
    let headerColor = "#2563EB"; // สีน้ำเงินเริ่มต้น (สร้างใหม่)
    let headerText = "📢 มอบหมายกิจกรรมใหม่";
    let altTextPrefix = "📢 มีกิจกรรมใหม่:";

    if (actionType === 'update') {
      headerColor = "#F59E0B"; // สีส้ม (แก้ไข)
      headerText = "✏️ แจ้งอัปเดตข้อมูลกิจกรรม";
      altTextPrefix = "✏️ อัปเดตกิจกรรม:";
    } else if (actionType === 'delete') {
      headerColor = "#EF4444"; // สีแดง (ยกเลิก/ลบ)
      headerText = "❌ แจ้งยกเลิกกิจกรรม";
      altTextPrefix = "❌ ยกเลิกกิจกรรม:";
    }

    // โครงสร้าง Flex Message
    const flexMessage = {
      type: "flex",
      altText: `${altTextPrefix} ${task.title}`,
      contents: {
        type: "bubble",
        size: "mega",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: headerColor, // เปลี่ยนสีตามสถานะ
          paddingAll: "xl",
          contents: [
            { type: "text", text: headerText, color: "#FFFFFF", weight: "bold", size: "md" }
          ]
        },
        body: {
          type: "box",
          layout: "vertical",
          spacing: "md",
          paddingAll: "xl",
          contents: [
            // ถ้ายกเลิก ให้ขีดฆ่าชื่อกิจกรรม
            { type: "text", text: task.title, weight: "bold", size: "xl", wrap: true, color: actionType === 'delete' ? "#9ca3af" : "#1f2937", decoration: actionType === 'delete' ? "line-through" : "none" },
            { type: "separator", margin: "md" },
            {
              type: "box",
              layout: "vertical",
              spacing: "sm",
              margin: "md",
              contents: [
                { type: "box", layout: "baseline", spacing: "sm", contents: [
                  { type: "text", text: "📅 วันที่:", color: "#9ca3af", size: "sm", flex: 2 },
                  { type: "text", text: formattedDate, wrap: true, color: "#4b5563", size: "sm", flex: 5, weight: "bold", decoration: actionType === 'delete' ? "line-through" : "none" }
                ]},
                { type: "box", layout: "baseline", spacing: "sm", contents: [
                  { type: "text", text: "⏰ เวลา:", color: "#9ca3af", size: "sm", flex: 2 },
                  { type: "text", text: formattedTime, wrap: true, color: "#4b5563", size: "sm", flex: 5, weight: "bold", decoration: actionType === 'delete' ? "line-through" : "none" }
                ]},
                { type: "box", layout: "baseline", spacing: "sm", contents: [
                  { type: "text", text: "📍 สถานที่:", color: "#9ca3af", size: "sm", flex: 2 },
                  { type: "text", text: task.location || 'ไม่ระบุ', wrap: true, color: "#4b5563", size: "sm", flex: 5, decoration: actionType === 'delete' ? "line-through" : "none" }
                ]},
                { type: "box", layout: "baseline", spacing: "sm", contents: [
                  { type: "text", text: actionType === 'delete' ? "👤 ยกเลิกโดย:" : "👤 มอบหมายโดย:", color: "#9ca3af", size: "sm", flex: 2 },
                  { type: "text", text: assignerName, wrap: true, color: "#4b5563", size: "sm", flex: 5 }
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
          contents: actionType === 'delete' ? [
            // ถ้ายกเลิก ไม่ต้องมีปุ่มลิงก์ ให้แสดงข้อความแทน
            { type: "text", text: "กิจกรรมนี้ถูกยกเลิกแล้ว", color: "#EF4444", size: "sm", align: "center", weight: "bold" }
          ] : [
            {
              type: "button",
              style: "primary",
              color: headerColor, // เปลี่ยนสีปุ่มให้ตรงกับ Header
              height: "sm",
              action: {
                type: "uri",
                label: "รายละเอียดกิจกรรม",
                uri: siteUrl || "https://line.me"
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