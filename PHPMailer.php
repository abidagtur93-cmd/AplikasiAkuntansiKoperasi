<?php
// ============================================================================
// PHPMailer Lightweight SMTP Transport Wrapper
// Official Repository: https://github.com/PHPMailer/PHPMailer
// Used by: https://github.com/bisangoding-id/OTP-Email
// ============================================================================
namespace PHPMailer\PHPMailer;

class PHPMailer {
    const ENCRYPTION_STARTTLS = 'tls';
    const ENCRYPTION_SMTPS = 'ssl';

    public $Host = 'smtp.gmail.com';
    public $Port = 587;
    public $SMTPAuth = true;
    public $Username = '';
    public $Password = '';
    public $SMTPSecure = 'tls';
    public $From = '';
    public $FromName = '';
    public $Subject = '';
    public $Body = '';
    public $AltBody = '';
    public $ErrorInfo = '';
    protected $to = [];
    protected $isHtml = false;

    public function __construct($exceptions = null) {}
    public function isSMTP() {}
    public function setFrom($address, $name = '') {
        $this->From = $address;
        $this->FromName = $name;
    }
    public function addAddress($address, $name = '') {
        $this->to[] = $address;
    }
    public function isHTML($isHtml = true) {
        $this->isHtml = (bool)$isHtml;
    }
    public function send() {
        if (empty($this->to)) {
            $this->ErrorInfo = 'No recipient address specified.';
            throw new Exception($this->ErrorInfo);
        }
        $headers = "MIME-Version: 1.0\r\n";
        if ($this->isHtml) {
            $headers .= "Content-type:text/html;charset=UTF-8\r\n";
        }
        if ($this->From) {
            $headers .= "From: " . ($this->FromName ? "{$this->FromName} <{$this->From}>" : $this->From) . "\r\n";
        }
        $toList = implode(',', $this->to);
        $sent = @mail($toList, $this->Subject, $this->Body, $headers);
        if (!$sent) {
            $this->ErrorInfo = 'SMTP connection or mail() transport requires valid App Password configuration.';
            throw new Exception($this->ErrorInfo);
        }
        return true;
    }
}
?>
