package site.classmanager.kiosk

import android.app.PendingIntent
import android.content.Intent
import android.content.IntentFilter
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : AppCompatActivity() {

    private var nfcAdapter: NfcAdapter? = null
    private val handler = Handler(Looper.getMainLooper())
    private val client = OkHttpClient()

    private lateinit var statusIcon: TextView
    private lateinit var titleText: TextView
    private lateinit var subtitleText: TextView
    private lateinit var studentName: TextView
    private lateinit var timeText: TextView

    private val API_BASE = "https://classmanager.site"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        statusIcon = findViewById(R.id.statusIcon)
        titleText = findViewById(R.id.titleText)
        subtitleText = findViewById(R.id.subtitleText)
        studentName = findViewById(R.id.studentName)
        timeText = findViewById(R.id.timeText)

        nfcAdapter = NfcAdapter.getDefaultAdapter(this)

        if (nfcAdapter == null) {
            titleText.text = "NFC를 지원하지 않는 기기입니다"
            subtitleText.text = ""
            return
        }

        if (!nfcAdapter!!.isEnabled) {
            titleText.text = "NFC를 켜주세요"
            subtitleText.text = "설정 → 연결 → NFC"
        }

        // Start clock
        updateClock()

        // Handle NFC intent if app was launched by NFC
        handleIntent(intent)
    }

    override fun onResume() {
        super.onResume()
        enableNfcForegroundDispatch()
    }

    override fun onPause() {
        super.onPause()
        nfcAdapter?.disableForegroundDispatch(this)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    private fun enableNfcForegroundDispatch() {
        val intent = Intent(this, javaClass).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val pendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_MUTABLE)
        val filters = arrayOf(
            IntentFilter(NfcAdapter.ACTION_TAG_DISCOVERED),
            IntentFilter(NfcAdapter.ACTION_NDEF_DISCOVERED),
            IntentFilter(NfcAdapter.ACTION_TECH_DISCOVERED),
        )
        val techLists = arrayOf(
            arrayOf("android.nfc.tech.NfcA"),
            arrayOf("android.nfc.tech.Ndef"),
            arrayOf("android.nfc.tech.MifareUltralight"),
        )
        nfcAdapter?.enableForegroundDispatch(this, pendingIntent, filters, techLists)
    }

    private fun handleIntent(intent: Intent) {
        val action = intent.action ?: return
        if (action == NfcAdapter.ACTION_TAG_DISCOVERED ||
            action == NfcAdapter.ACTION_NDEF_DISCOVERED ||
            action == NfcAdapter.ACTION_TECH_DISCOVERED) {

            val tag: Tag? = intent.getParcelableExtra(NfcAdapter.EXTRA_TAG)
            tag?.let {
                val uid = it.id.joinToString("") { byte -> "%02X".format(byte) }
                checkIn(uid)
            }
        }
    }

    private fun checkIn(nfcUid: String) {
        // Show loading
        runOnUiThread {
            statusIcon.text = "⏳"
            titleText.text = "확인 중..."
            subtitleText.text = "UID: $nfcUid"
            studentName.visibility = View.GONE
        }

        val json = JSONObject().put("nfc_uid", nfcUid).toString()
        val body = json.toRequestBody("application/json".toMediaType())

        val request = Request.Builder()
            .url("$API_BASE/api/attendance/check-in/nfc")
            .post(body)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                showError("서버 연결 실패")
            }

            override fun onResponse(call: Call, response: Response) {
                val responseBody = response.body?.string() ?: ""
                try {
                    val json = JSONObject(responseBody)
                    if (response.isSuccessful && json.optBoolean("ok", false)) {
                        val name = json.optString("student_name", "")
                        val status = json.optString("status", "present")
                        if (status == "already_checked") {
                            showAlready(name)
                        } else {
                            showSuccess(name)
                        }
                    } else {
                        val detail = json.optString("detail", "인식 실패")
                        showError(detail)
                    }
                } catch (e: Exception) {
                    showError("응답 파싱 실패")
                }
            }
        })
    }

    private fun showSuccess(name: String) {
        runOnUiThread {
            statusIcon.text = "✅"
            statusIcon.setBackgroundResource(R.drawable.circle_success)
            titleText.text = "출석 완료!"
            subtitleText.text = ""
            studentName.text = "$name 학생"
            studentName.visibility = View.VISIBLE
        }
        resetAfterDelay()
    }

    private fun showAlready(name: String) {
        runOnUiThread {
            statusIcon.text = "⚠️"
            statusIcon.setBackgroundResource(R.drawable.circle_warning)
            titleText.text = "이미 출석됨"
            subtitleText.text = ""
            studentName.text = "$name 학생"
            studentName.visibility = View.VISIBLE
        }
        resetAfterDelay()
    }

    private fun showError(message: String) {
        runOnUiThread {
            statusIcon.text = "❌"
            statusIcon.setBackgroundResource(R.drawable.circle_error)
            titleText.text = message
            subtitleText.text = ""
            studentName.visibility = View.GONE
        }
        resetAfterDelay()
    }

    private fun resetAfterDelay() {
        handler.postDelayed({
            statusIcon.text = "📱"
            statusIcon.setBackgroundResource(R.drawable.circle_bg)
            titleText.text = "NFC 카드를 터치하세요"
            subtitleText.text = "기기 뒷면에 카드를 가까이 대세요"
            studentName.visibility = View.GONE
        }, 3000)
    }

    private fun updateClock() {
        val sdf = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
        timeText.text = sdf.format(Date())
        handler.postDelayed({ updateClock() }, 1000)
    }
}
