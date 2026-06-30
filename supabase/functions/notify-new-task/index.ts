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
    const { task, userIds, assignerName, siteUrl, actionType = 'create' } = await req.json();

    if (!task || !userIds || userIds.length === 0) {
      return new Response(JSON.stringify({ message: "No data or users" }), { headers: corsHeaders });
    }

    // ---------------------------------------------------------
    // 🐞 DEBUG LOGS
    console.log("========================================");
    console.log("เป้าหมาย User IDs (ส่งแชทส่วนตัว):", userIds);
    // ---------------------------------------------------------

    const formatThaiDate = (dateStr: string) => {
      if (!dateStr) return '';
      const dateObj = new Date(dateStr);
      const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
      return `${String(dateObj.getDate()).padStart(2, '0')} ${thaiMonths[dateObj.getMonth()]} ${dateObj.getFullYear() + 543}`;
    };

    const startDateFormatted = formatThaiDate(task.date);
    let displayDate = startDateFormatted;
    
    const endDateObj = task.endDate || task.end_date;
    if (endDateObj && endDateObj !== task.date) {
      const endDateFormatted = formatThaiDate(endDateObj);
      displayDate = `${startDateFormatted} - ${endDateFormatted}`;
    }

    const formattedTime = task.time ? `${task.time.substring(0, 5)} น.` : 'ไม่ระบุ';

    // 🎨 กำหนดสีและข้อความตาม Action (ใช้การไล่สี Gradient ให้ตรงกับ Design SCB Connect)
    let startColor = "#722ed1";
    let endColor = "#9254de";
    let mainColor = "#722ed1";
    let subTitle = "รายการมอบหมายกิจกรรม";
    let altTextPrefix = "📢 มีกิจกรรมใหม่:";
    let iconText = "🗓️ แจ้งเตือนกิจกรรมใหม่";

    if (actionType === 'update') {
      startColor = "#d97706"; // โทนส้ม
      endColor = "#f59e0b";
      mainColor = "#d97706";
      subTitle = "รายการอัปเดตกิจกรรม";
      altTextPrefix = "✏️ อัปเดตกิจกรรม:";
      iconText = "✏️ แจ้งอัปเดตกิจกรรม";
    } else if (actionType === 'delete') {
      startColor = "#dc2626"; // โทนแดง
      endColor = "#ef4444";
      mainColor = "#dc2626";
      subTitle = "รายการยกเลิกกิจกรรม";
      altTextPrefix = "❌ ยกเลิกกิจกรรม:";
      iconText = "❌ แจ้งยกเลิกกิจกรรม";
    }

    // 🌟 สร้างโครงสร้าง Flex Message สไตล์ SCB Connect จาก HTML ที่ให้มา
    const flexMessage = {
      type: "flex",
      altText: `${altTextPrefix} ${task.title}`,
      contents: {
        type: "bubble",
        size: "mega",
        header: {
          type: "box",
          layout: "vertical",
          paddingAll: "xl",
          backgroundColor: mainColor,
          contents: [
            { type: "text", text: iconText, color: "#ffffff", weight: "bold", size: "md" }
          ]
        },
        body: {
          type: "box",
          layout: "vertical",
          paddingAll: "xl",
          contents: [
            { type: "text", text: subTitle, color: "#68626e", size: "sm" },
            { 
              type: "text", 
              text: task.title, 
              color: mainColor, 
              size: "xl", 
              weight: "bold", 
              wrap: true, 
              margin: "sm",
              decoration: actionType === 'delete' ? "line-through" : "none"
            },
            {
              type: "box",
              layout: "vertical",
              margin: "xl",
              spacing: "md",
              contents: [
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    { type: "text", text: "วันที่", color: "#68626e", size: "sm", flex: 2 },
                    { 
                      type: "text", 
                      text: displayDate, 
                      color: "#1b1c1c", 
                      size: "sm", 
                      flex: 5, 
                      align: "end", 
                      wrap: true, 
                      weight: "bold",
                      decoration: actionType === 'delete' ? "line-through" : "none" 
                    }
                  ]
                },
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    { type: "text", text: "เวลา", color: "#68626e", size: "sm", flex: 2 },
                    { 
                      type: "text", 
                      text: formattedTime, 
                      color: "#1b1c1c", 
                      size: "sm", 
                      flex: 5, 
                      align: "end", 
                      wrap: true, 
                      weight: "bold",
                      decoration: actionType === 'delete' ? "line-through" : "none"
                    }
                  ]
                },
                {
                  type: "box",
                  layout: "vertical",
                  contents: [
                    { type: "text", text: "สถานที่", color: "#68626e", size: "sm" },
                    { 
                      type: "text", 
                      text: task.location || 'ไม่ระบุ', 
                      color: "#1b1c1c", 
                      size: "sm", 
                      wrap: true, 
                      weight: "bold",
                      decoration: actionType === 'delete' ? "line-through" : "none",
                      margin: "sm"
                    }
                  ]
                }
              ]
            },
            { type: "separator", margin: "xl", color: "#e4e2e2" },
            {
              type: "box",
              layout: "horizontal",
              margin: "xl",
              contents: [
                { type: "text", text: actionType === 'delete' ? "ยกเลิกโดย" : "มอบหมายโดย", color: "#68626e", size: "sm", flex: 4 },
                { type: "text", text: assignerName, color: "#1b1c1c", size: "sm", flex: 5, align: "end", weight: "bold", wrap: true }
              ]
            }
          ]
        },
        footer: {
          type: "box",
          layout: "vertical",
          paddingAll: "xl",
          paddingTop: "none",
          contents: actionType === 'delete' ? [
            { type: "text", text: "กิจกรรมนี้ถูกยกเลิกแล้ว", color: "#EF4444", size: "md", align: "center", weight: "bold" }
          ] : [
            {
              type: "button",
              style: "primary",
              color: mainColor,
              height: "sm",
              action: {
                type: "uri",
                label: "ดูรายละเอียดกิจกรรม",
                uri: siteUrl || "https://line.me"
              }
            }
          ]
        }
      }
    };

    const promises = [];
    

    // ส่งเข้าแชทส่วนตัวของผู้รับผิดชอบ (แบบ Multicast)
    if (userIds && userIds.length > 0) {
      promises.push(
        fetch("https://api.line.me/v2/bot/message/multicast", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LINE_ACCESS_TOKEN}` },
          body: JSON.stringify({ to: userIds, messages: [flexMessage] })
        })
      );
    }

    await Promise.all(promises);

    return new Response(JSON.stringify({ success: true, message: "แจ้งเตือนสำเร็จ" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});