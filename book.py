import requests

cookies = {
    '_ga': 'GA1.1.1976894094.1764384383',
    'QueueITAccepted-SDFrts345E-V3_quanghungmasterd': 'EventId%3Dquanghungmasterd%26QueueId%3D1ca41768-a02b-4f9b-a624-23269561c952%26RedirectType%3Dqueue%26IssueTime%3D1764385388%26Hash%3Db1ddb4fc82b86968cb472c4967722871ceec025c698a4ec14a3b539a5a5a13fd',
    'AWSALB': 'C4kcHS7V4OrQGXzXh/Kkd4170Msh0t+jp0J6gzCkClWTaQeemHU1hX0pHt30rqOgHtoLlQpHL1KBnB1jLNw5zFLb45Z1UHAOvd/8vkonvIMd2EJMefm+pTvii36qQkbSSHSPsFzKshS8QDbZE5z88GSWMAz7v1Yia8Ch2g+O6ip8pu03XoJHe5yqH8zzGg==',
    'AWSALBCORS': 'C4kcHS7V4OrQGXzXh/Kkd4170Msh0t+jp0J6gzCkClWTaQeemHU1hX0pHt30rqOgHtoLlQpHL1KBnB1jLNw5zFLb45Z1UHAOvd/8vkonvIMd2EJMefm+pTvii36qQkbSSHSPsFzKshS8QDbZE5z88GSWMAz7v1Yia8Ch2g+O6ip8pu03XoJHe5yqH8zzGg==',
    '_ga_QW069PTNY7': 'GS2.1.s1764384382$o1$g1$t1764385887$j60$l0$h0',
}

headers = {
    'accept': 'application/json',
    'accept-language': 'en-US,en;q=0.9',
    'authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InZ1cXVvYzFxMXFAZ21haWwuY29tIiwicm9sZSI6IlVTRVIiLCJpYXQiOjE3NjQzODQzODYsImV4cCI6MTc2Njk3NjM4Nn0.hFvliu4MqWIhfgQBZgrqk0AEuXHFZCjlwczgQGqSqDA',
    'content-type': 'application/json',
    'origin': 'https://quanghungmasterd.1zone.vn',
    'priority': 'u=1, i',
    'referer': 'https://quanghungmasterd.1zone.vn/',
    'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
    'sec-ch-ua-mobile': '?1',
    'sec-ch-ua-platform': '"Android"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site',
    'timestamp': '1764385887491',
    'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36',
    'x-captcha-token': 'P1_eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.haJwZACjZXhwzmkqZNSncGFzc2tlecUEgVK2Ao-0qdAg8Df4pq275sqYTDdDLyj_3bhXim43s-pfpvzRufSaL7wF_nSi-hPROwo-4xD6yhJWRr2Wl-6sjR4IkvfwCCtiuEt0YE7fQTL9t5WYwbeRfcKElHY33_1SH7Q86QfDb0SLzBgsKuJQzWWVR1pjF2hVbcVzjrCy6SgUagxuEPj6UjXexUYdNXJYvktvqghdEznGAyIJjc4jtUBc3jmIPrcbn6vFrMqfcpkGt280cjC7lzruOvGthfncIjYF5u6Dez5A00A3ZU2xtOMAqNDvoXpotCgLzEwZPtMUfzwaNw9wGQl_w_wdQvnLC1iMQX5T-ZeJEewuL-vG20OQN58tEw1sqP-lMdAJF9Xl8Hskrkx72nfgEWOgyyvoMjfiNWE3quSO6NSm2qhcMZ4DSOldhyHv99fcwtEiYNiA77G5TmLuv1rwrQfB1YgydIUqS06hd62_fDPLSN8CQjaZi-4YOVd6ZvvJBlozVHjya-Jr7Ku5JnNCYm1YXYJDz5UjuJ9tqXYPrRmzOd0SkrS9kOfeUZ-UL-BPmc72_aDQfjPIblYR10xNa5TmvpZksrckq_LpZjqp0OkQ2wfnO3NEg4qAXnF8U2VlrBRvIJPHr8s25ItYv2MJ4PCtUsuKwzJs215q4zzUBKxsoY--L2zJN0SLoRqdGaZU7QnaBjsHGWaWrc5Uv3aGyn8eAk06_ICQfoq5kx7WSBZf3R-ojiN81tXEYJtfXQZ6SvNK14zODhKIDrtgcZ2NUdf8i8wM84CtUAlRbmtH9aRYo7A8tDSnmqiIiWo0iDPJxQnGWIBebzwd-k38FJHEiXQ_5zfFnO_86PVDFJQb96PKyOFt3lZnlmV0Xfzcuf4CE-B0rFr5GuAPu4mdUi7PbVDakizowWs6FaQINrarQ5V1GU8s9enRsg5ljJZ1BIWDvhwef6DQnAAbUzmNhisZ1eeHjO1oojYGY1agGqH9PlcqZ7blFckFasKsai2SxqE7OZksGUHSjCxNwMuSuxVTbi8pPOvXopPeJeQQRXyxOKlaqvybDzQkcwuhOmcS4fyGaGK-bVz945g5I-zZQDQE8pEP1w3Bap9YSXkEdYWQ8mMB0lfwdqYtLX6O10zlIGiC5LmNcXbcH3HzIAlEk8nC7xq8t__Ge1wE5F315rxGDFBDuFv0XFJInz0vxwyEI33APl2s3YLdKXuoj2LN2XZuwMr_LroKUbUDhS3OBa-Zg_UverFmw69roMfzW8kklQbJ8Smh54SJTX1koaRGF7BD2y1s2b5CHOzKxhHznyZd5BtzA4SIHgFjNB5j0FBm_h0YpWB93Jq1LtIusSvM0KSwFKEB1rHzgvDdTLfZnLyIVVeN-xorsz-FT8vKIAyTDVh_269hEF6pfWPMg8MTVJZmj5nSM-7ocDfG7q15o9hnTkoqEuraYZ1l8xQiMxYy19WXMlrQBWvM3D4q-6Q4H-OILXQ3h__8hLcLsvGaPSnwcY7Yw3GA1yXEhkrMArbWRB6qg0OffN-7YPCplOMnyE4jx1u0wuQI9oOia3KoMWZiMmIwODGoc2hhcmRfaWTOFZnkVA.yRTyoIQCrGbiLMmQdlkTTkUWGnSzCqsvlfr5J44TiEs',
    # 'cookie': '_ga=GA1.1.1976894094.1764384383; QueueITAccepted-SDFrts345E-V3_quanghungmasterd=EventId%3Dquanghungmasterd%26QueueId%3D1ca41768-a02b-4f9b-a624-23269561c952%26RedirectType%3Dqueue%26IssueTime%3D1764385388%26Hash%3Db1ddb4fc82b86968cb472c4967722871ceec025c698a4ec14a3b539a5a5a13fd; AWSALB=C4kcHS7V4OrQGXzXh/Kkd4170Msh0t+jp0J6gzCkClWTaQeemHU1hX0pHt30rqOgHtoLlQpHL1KBnB1jLNw5zFLb45Z1UHAOvd/8vkonvIMd2EJMefm+pTvii36qQkbSSHSPsFzKshS8QDbZE5z88GSWMAz7v1Yia8Ch2g+O6ip8pu03XoJHe5yqH8zzGg==; AWSALBCORS=C4kcHS7V4OrQGXzXh/Kkd4170Msh0t+jp0J6gzCkClWTaQeemHU1hX0pHt30rqOgHtoLlQpHL1KBnB1jLNw5zFLb45Z1UHAOvd/8vkonvIMd2EJMefm+pTvii36qQkbSSHSPsFzKshS8QDbZE5z88GSWMAz7v1Yia8Ch2g+O6ip8pu03XoJHe5yqH8zzGg==; _ga_QW069PTNY7=GS2.1.s1764384382$o1$g1$t1764385887$j60$l0$h0',
}

json_data = {
    'eventId': '3SH9do',
    'seatmapTickets': [
        {
            'id': '691ddae3aec5e6925434b36a',
            'ticketClassId': '691dd73faec5e6925434aafc',
        },
    ],
    'seatLabels': [
        'A20',
    ],
}

response = requests.post(
    'https://prod.1zone.vn/ticketing/api/v3/order/add-to-cart',
    cookies=cookies,
    headers=headers,
    json=json_data,
)


print(response.text)

# Note: json_data will not be serialized by requests
# exactly as it was in the original request.
#data = '{"eventId":"3SH9do","seatmapTickets":[{"id":"691ddae3aec5e6925434b36a","ticketClassId":"691dd73faec5e6925434aafc"}],"seatLabels":["A20"]}'
#response = requests.post('https://prod.1zone.vn/ticketing/api/v3/order/add-to-cart', cookies=cookies, headers=headers, data=data)