import connection from '../connection/dbConfig.js';
import languageMessage from '../controller/languageMessage.js';

const getContent = (request, response) => {
    const query = "SELECT content_id, content_type, content FROM content_master WHERE delete_flag = 0";
    connection.query(query, (err, rows) => {
        if (err) {
            return response.status(200).json({ success: false, error: languageMessage.internalServerError });
        }
        let webservice_url = process.env.WEBSERVICE_URL;
        const content_arr = rows.map(row => ({
            content_id: row.content_id,
            content_type: row.content_type, 
            content: row.content,
            content_url: `${webservice_url}/get_all_content_url?content_type=${row.content_type}`,
            status: false 
        }));
        if (content_arr.length === 0) {
            const content_arr = 'NA';
            return response.status(200).json({ success: true, message: languageMessage.msgDataFound , content_arr });
        }
        return response.status(200).json({ success: true, message: languageMessage.msgDataFound , content_arr });
    });
};

const getAllContentUrl = (request, response) => {
    try {
        const { content_type } = request.query;
        const query1 = "SELECT content_id, content_type, content FROM content_master WHERE delete_flag = 0 AND content_type = ? ";
        const val1 = [content_type];
        connection.query(query1, val1, (valError, valResult) => {
            if (valError) {
                return response.status(200).json({ success: false, msg: message.internalServerError });
            }
            if (valResult.length === 0) {
                return response.status(200).json({ success: false, msg: message.msgDataNotFound });
            }
            let content_en;
                content_en = valResult[0].content
            let new12 = '<html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src * data: gap: content:"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, minimal-ui"><title>Data</title></head><body style="word-break: break-all;">' + content_en + '</body></html>';
            return response.send(new12);
        });
    } catch (error) {
        return response.status(200).json({ success: false, msg: message.internalServerError });
    }
};
export { getContent, getAllContentUrl}