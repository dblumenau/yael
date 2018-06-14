@component('mail::message')
# New Contact Submission From Website

##Hi Yael
###You have a new contact form submission from your website
####From: {{$contact->contactName}}
####Email: <a href="mailto:{{$contact->email}}">{{$contact->email}}</a>
@component('mail::panel')
    Message: {{$contact->comments}}
@endcomponent

Thanks,<br>
{{ config('app.name') }}
@endcomponent
